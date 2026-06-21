param(
  [switch]$SelfTest
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase

$script:Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$script:Port = if ($env:CHAOSONE_PORT) { $env:CHAOSONE_PORT } elseif ($env:NOVAOS_PORT) { $env:NOVAOS_PORT } else { "4788" }
$script:BaseUrl = "http://localhost:$script:Port"
$script:LogDir = Join-Path $script:Root "logs"
$script:StdoutLog = Join-Path $script:LogDir "chaosone.out.log"
$script:StderrLog = Join-Path $script:LogDir "chaosone.err.log"
$script:BundledNode = Join-Path $script:Root "runtime\node\node.exe"
$script:CurrentJobId = $null

New-Item -ItemType Directory -Force -Path $script:LogDir | Out-Null

function Invoke-ChaosApi {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [string]$Method = "GET",
    [object]$Body = $null,
    [int]$TimeoutSec = 3
  )

  $uri = "$script:BaseUrl$Path"
  if ($Body -ne $null) {
    $json = $Body | ConvertTo-Json -Depth 8
    return Invoke-RestMethod -Uri $uri -Method $Method -Body $json -ContentType "application/json" -TimeoutSec $TimeoutSec
  }

  return Invoke-RestMethod -Uri $uri -Method $Method -TimeoutSec $TimeoutSec
}

function Test-ChaosServer {
  try {
    Invoke-ChaosApi -Path "/api/status" -TimeoutSec 2 | Out-Null
    return $true
  } catch {
    return $false
  }
}

function Start-ChaosServer {
  if (Test-ChaosServer) {
    return $true
  }

  $nodePath = $null
  if (Test-Path $script:BundledNode) {
    $nodePath = $script:BundledNode
  } else {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if ($node) {
      $nodePath = $node.Source
    }
  }

  if (-not $nodePath) {
    throw "No encuentro el runtime de ChaosOne ni Node.js en PATH."
  }

  Start-Process -FilePath $nodePath -ArgumentList "src/server.js" -WorkingDirectory $script:Root -WindowStyle Hidden -RedirectStandardOutput $script:StdoutLog -RedirectStandardError $script:StderrLog | Out-Null

  for ($i = 0; $i -lt 30; $i++) {
    if (Test-ChaosServer) {
      return $true
    }
    Start-Sleep -Milliseconds 500
  }

  throw "ChaosOne no ha arrancado. Revisa los logs en $script:LogDir"
}

function Set-UiStatus {
  param(
    [string]$ServerText,
    [string]$BrainText,
    [string]$Details = $null
  )

  if ($ServerText) { $serverStatus.Text = $ServerText }
  if ($BrainText) { $brainStatus.Text = $BrainText }
  if ($Details -ne $null) { $outputBox.Text = $Details }
}

function Refresh-ChaosStatus {
  try {
    $serverReady = Test-ChaosServer
    if ($serverReady) {
      $status = Invoke-ChaosApi -Path "/api/status"
      $serverText = "ChaosOne esta activo en $script:BaseUrl"
      if ($status.provider -and $status.model) {
        $serverText = "$serverText - $($status.provider) / $($status.model)"
      }
      if ($status.version) {
        $versionText.Text = "Version $($status.version)"
      }
      $openButton.IsEnabled = $true
    } else {
      $serverText = "ChaosOne aun no esta arrancado."
      $openButton.IsEnabled = $false
    }

    $brainText = "Cerebro local: pendiente de comprobar."
    if ($serverReady) {
      try {
        $runtime = Invoke-ChaosApi -Path "/api/local-runtime/status" -TimeoutSec 5
        $modelNames = @()
        foreach ($model in $runtime.recommendedModels) {
          $modelNames += $model.model
        }

        if ($modelCombo.Items.Count -eq 0 -and $modelNames.Count -gt 0) {
          foreach ($name in $modelNames) { [void]$modelCombo.Items.Add($name) }
          $modelCombo.SelectedIndex = 0
        }

        if ($runtime.reachable -and $runtime.hasActiveModel) {
          $brainText = "Cerebro local listo: $($runtime.activeModel)"
        } elseif ($runtime.reachable) {
          $brainText = "Runtime local detectado. Falta descargar el modelo activo: $($runtime.activeModel)"
        } elseif ($runtime.commandAvailable) {
          $brainText = "Ollama esta instalado, pero su servicio local no responde."
        } else {
          $brainText = "Ollama no detectado. Puedes instalarlo y volver a comprobar."
        }
      } catch {
        $brainText = "No he podido comprobar el cerebro local: $($_.Exception.Message)"
      }
    }

    Set-UiStatus -ServerText $serverText -BrainText $brainText
  } catch {
    Set-UiStatus -ServerText "Error comprobando ChaosOne." -BrainText "Cerebro local: sin comprobar." -Details $_.Exception.Message
  }
}

function Start-ModelPull {
  try {
    Start-ChaosServer | Out-Null
    $selectedModel = [string]$modelCombo.SelectedItem
    if (-not $selectedModel) {
      $selectedModel = "tinyllama"
    }

    $result = Invoke-ChaosApi -Path "/api/local-runtime/pull" -Method "POST" -Body @{
      model = $selectedModel
      approved = $true
    } -TimeoutSec 5

    $script:CurrentJobId = $result.id
    $downloadButton.IsEnabled = $false
    $outputBox.Text = "Descarga iniciada: $selectedModel`r`nTrabajo: $script:CurrentJobId"
    $jobTimer.Start()
  } catch {
    $downloadButton.IsEnabled = $true
    $outputBox.Text = $_.Exception.Message
  }
}

function Poll-ModelJob {
  if (-not $script:CurrentJobId) {
    $jobTimer.Stop()
    return
  }

  try {
    $job = Invoke-ChaosApi -Path "/api/local-runtime/jobs/$script:CurrentJobId" -TimeoutSec 3
    $lines = @("Estado: $($job.status)", "Modelo: $($job.model)", "")
    if ($job.output) { $lines += $job.output }
    if ($job.error) { $lines += ""; $lines += "Error: $($job.error)" }
    $outputBox.Text = ($lines -join "`r`n")
    $outputBox.ScrollToEnd()

    if ($job.status -in @("ready", "error")) {
      $jobTimer.Stop()
      $downloadButton.IsEnabled = $true
      Refresh-ChaosStatus
    }
  } catch {
    $jobTimer.Stop()
    $downloadButton.IsEnabled = $true
    $outputBox.Text = $_.Exception.Message
  }
}

$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="ChaosOne" Width="760" Height="560" WindowStartupLocation="CenterScreen"
        ResizeMode="CanResize" Background="#0E1118">
  <Grid Margin="22">
    <Grid.RowDefinitions>
      <RowDefinition Height="Auto"/>
      <RowDefinition Height="Auto"/>
      <RowDefinition Height="*"/>
      <RowDefinition Height="Auto"/>
    </Grid.RowDefinitions>

    <Border Grid.Row="0" CornerRadius="12" Background="#171C26" Padding="18">
      <Grid>
        <Grid.ColumnDefinitions>
          <ColumnDefinition Width="Auto"/>
          <ColumnDefinition Width="*"/>
        </Grid.ColumnDefinitions>
        <Border Width="64" Height="64" CornerRadius="14" Background="#232B3A">
          <Image x:Name="logoImage" Stretch="Uniform" Margin="8"/>
        </Border>
        <StackPanel Grid.Column="1" Margin="18,0,0,0">
          <TextBlock Text="ChaosOne" FontSize="30" FontWeight="SemiBold" Foreground="#F7F8FB"/>
          <TextBlock x:Name="versionText" Text="Version ..." FontSize="13" Foreground="#728099" Margin="0,1,0,0"/>
          <TextBlock Text="Tu asistente local con cerebro propio" FontSize="15" Foreground="#AEB7C8" Margin="0,4,0,0"/>
        </StackPanel>
      </Grid>
    </Border>

    <StackPanel Grid.Row="1" Margin="0,18,0,14">
      <TextBlock x:Name="serverStatus" Text="Preparando ChaosOne..." Foreground="#F7F8FB" FontSize="15"/>
      <TextBlock x:Name="brainStatus" Text="Cerebro local: pendiente de comprobar." Foreground="#AEB7C8" FontSize="14" Margin="0,5,0,0"/>
    </StackPanel>

    <Grid Grid.Row="2">
      <Grid.ColumnDefinitions>
        <ColumnDefinition Width="260"/>
        <ColumnDefinition Width="*"/>
      </Grid.ColumnDefinitions>

      <Border Grid.Column="0" CornerRadius="10" Background="#171C26" Padding="16" Margin="0,0,14,0">
        <StackPanel>
          <TextBlock Text="Acciones" Foreground="#F7F8FB" FontSize="18" FontWeight="SemiBold" Margin="0,0,0,14"/>
          <Button x:Name="startButton" Content="Arrancar ChaosOne" Height="38" Margin="0,0,0,10"/>
          <Button x:Name="openButton" Content="Abrir panel web" Height="38" Margin="0,0,0,10"/>
          <Button x:Name="refreshButton" Content="Comprobar estado" Height="38" Margin="0,0,0,18"/>

          <TextBlock Text="Modelo local" Foreground="#F7F8FB" FontSize="15" FontWeight="SemiBold" Margin="0,0,0,8"/>
          <ComboBox x:Name="modelCombo" Height="32" Margin="0,0,0,10"/>
          <Button x:Name="downloadButton" Content="Descargar modelo" Height="38" Margin="0,0,0,10"/>
          <Button x:Name="ollamaButton" Content="Instalar Ollama" Height="38" Margin="0,0,0,18"/>

          <Button x:Name="logsButton" Content="Abrir logs" Height="34"/>
        </StackPanel>
      </Border>

      <Border Grid.Column="1" CornerRadius="10" Background="#111620" Padding="14">
        <Grid>
          <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="*"/>
          </Grid.RowDefinitions>
          <TextBlock Text="Progreso" Foreground="#F7F8FB" FontSize="18" FontWeight="SemiBold" Margin="0,0,0,10"/>
          <TextBox x:Name="outputBox" Grid.Row="1" IsReadOnly="True" TextWrapping="Wrap" AcceptsReturn="True"
                   VerticalScrollBarVisibility="Auto" Background="#0B0F16" Foreground="#DDE5F4"
                   BorderBrush="#263246" FontFamily="Consolas" FontSize="12" Padding="10"/>
        </Grid>
      </Border>
    </Grid>

    <TextBlock Grid.Row="3" Text="ChaosOne arranca el backend oculto y mantiene esta ventana como centro de control." Foreground="#728099" Margin="0,14,0,0"/>
  </Grid>
</Window>
"@

$reader = New-Object System.Xml.XmlNodeReader ([xml]$xaml)
$window = [Windows.Markup.XamlReader]::Load($reader)

$serverStatus = $window.FindName("serverStatus")
$brainStatus = $window.FindName("brainStatus")
$versionText = $window.FindName("versionText")
$outputBox = $window.FindName("outputBox")
$startButton = $window.FindName("startButton")
$openButton = $window.FindName("openButton")
$refreshButton = $window.FindName("refreshButton")
$downloadButton = $window.FindName("downloadButton")
$ollamaButton = $window.FindName("ollamaButton")
$logsButton = $window.FindName("logsButton")
$modelCombo = $window.FindName("modelCombo")
$logoImage = $window.FindName("logoImage")

$logoPath = Join-Path $script:Root "web\assets\logo.png"
if (Test-Path $logoPath) {
  $bitmap = New-Object System.Windows.Media.Imaging.BitmapImage
  $bitmap.BeginInit()
  $bitmap.UriSource = New-Object System.Uri($logoPath)
  $bitmap.CacheOption = [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad
  $bitmap.EndInit()
  $logoImage.Source = $bitmap
}

$jobTimer = New-Object System.Windows.Threading.DispatcherTimer
$jobTimer.Interval = [TimeSpan]::FromSeconds(1.5)
$jobTimer.Add_Tick({ Poll-ModelJob })

$startButton.Add_Click({
  try {
    $outputBox.Text = "Arrancando ChaosOne..."
    Start-ChaosServer | Out-Null
    Refresh-ChaosStatus
    $outputBox.Text = "ChaosOne esta listo en $script:BaseUrl"
  } catch {
    $outputBox.Text = $_.Exception.Message
  }
})

$openButton.Add_Click({ Start-Process $script:BaseUrl })
$refreshButton.Add_Click({ Refresh-ChaosStatus })
$downloadButton.Add_Click({ Start-ModelPull })
$ollamaButton.Add_Click({ Start-Process "https://ollama.com/download/windows" })
$logsButton.Add_Click({ Start-Process $script:LogDir })

$window.Add_ContentRendered({
  try {
    Start-ChaosServer | Out-Null
  } catch {
    $outputBox.Text = $_.Exception.Message
  }
  Refresh-ChaosStatus
})

if ($SelfTest) {
  "ChaosOne launcher self-test ok"
  exit 0
}

[void]$window.ShowDialog()

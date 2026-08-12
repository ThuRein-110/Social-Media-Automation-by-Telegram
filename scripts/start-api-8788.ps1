$root = Resolve-Path "$PSScriptRoot\.."
$env:PORT = "8788"
Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "server") -WorkingDirectory $root -WindowStyle Hidden

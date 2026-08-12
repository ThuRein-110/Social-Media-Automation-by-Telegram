$root = Resolve-Path "$PSScriptRoot\.."
Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "server") -WorkingDirectory $root -WindowStyle Hidden

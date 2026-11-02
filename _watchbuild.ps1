$ErrorActionPreference = 'Continue'
Set-Location -LiteralPath 'C:\Users\mrand\OneDrive\Рабочий стол\workout-tracker'
Get-Process esbuild -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item build.log,build2.log -ErrorAction SilentlyContinue

$p = Start-Process -FilePath "cmd.exe" -ArgumentList '/c','npm run build > build.log 2>&1' -NoNewWindow -PassThru
if (-not $p.WaitForExit(180000)) {
  taskkill /PID $p.Id /T /F | Out-Null
  Write-Output "TIMEOUT"
} else {
  Write-Output "EXIT:$($p.ExitCode)"
}
Write-Output "----TAIL----"
Get-Content build.log -Tail 120

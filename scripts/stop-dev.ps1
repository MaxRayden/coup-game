# Libera as portas do Coup antes de npm run dev (Windows PowerShell)
$ports = @(7000, 7001)
foreach ($port in $ports) {
  Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object {
      if ($_ -and $_ -ne 0) {
        Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
        Write-Host "Porta $port liberada (PID $_)"
      }
    }
}

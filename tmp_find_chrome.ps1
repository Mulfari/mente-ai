Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" |
  Where-Object { $_.CommandLine -like '*mcp-chrome*' -or $_.CommandLine -like '*playwright*' } |
  Select-Object ProcessId, CommandLine |
  Format-List

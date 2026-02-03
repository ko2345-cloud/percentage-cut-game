$scriptPath = "c:\Users\tak\Desktop\Percentage_Cut\script.js"
$lines = Get-Content $scriptPath -Encoding UTF8

$newLines = @()
for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    
    # Update split-screen line references from querySelector to getElementById
    if ($line -match "const splitLine = document\.querySelector\('\.split-screen-line'\);") {
        $newLines += "        const splitLine = document.getElementById('splitLine');"
        continue
    }
    
    $newLines += $line
}

$newLines | Set-Content $scriptPath -Encoding UTF8

Write-Host "Split-screen line selector updated!"

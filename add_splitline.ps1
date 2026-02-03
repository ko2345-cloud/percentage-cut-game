$htmlPath = "c:\Users\tak\Desktop\Percentage_Cut\index.html"
$lines = Get-Content $htmlPath -Encoding UTF8

$newLines = @()
for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    
    # Add split-screen divider after canvas
    if ($line -match '<canvas id="gameCanvas"></canvas>') {
        $newLines += $line
        $newLines += ""
        $newLines += "        <!-- Split Screen Divider -->"
        $newLines += "        <div class=`"split-screen-line`" id=`"splitLine`"></div>"
        continue
    }
    
    $newLines += $line
}

$newLines | Set-Content $htmlPath -Encoding UTF8

Write-Host "HTML updated with split-screen divider!"

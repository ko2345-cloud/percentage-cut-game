$scriptPath = "c:\Users\tak\Desktop\Percentage_Cut\script.js"
$content = Get-Content $scriptPath -Raw -Encoding UTF8

# Fix missing closing quotes in translation strings
# These are the lines that have missing quotes
$fixes = @(
    @{ Pattern = 'selectLevel: "([^"]+),'; Replacement = 'selectLevel: "$1",' },
    @{ Pattern = 'placeHand: "([^"]+),'; Replacement = 'placeHand: "$1",' },
    @{ Pattern = 'redLineBlock: "([^"]+),'; Replacement = 'redLineBlock: "$1",' },
    @{ Pattern = 'timeUp: "([^"]+),'; Replacement = 'timeUp: "$1",' },
    @{ Pattern = 'cameraError: "([^"]+)\r'; Replacement = 'cameraError: "$1"\r' }
)

foreach ($fix in $fixes) {
    $content = $content -replace $fix.Pattern, $fix.Replacement
}

# Save the fixed content
Set-Content $scriptPath -Value $content -Encoding UTF8 -NoNewline

Write-Host "Fixed missing quotes in script.js"

# Verify the fix by checking line 12
$lines = Get-Content $scriptPath -Encoding UTF8
Write-Host "`nLine 12: $($lines[11])"

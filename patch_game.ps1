$scriptPath = "c:\Users\tak\Desktop\Percentage_Cut\script.js"
$lines = Get-Content $scriptPath -Encoding UTF8

# Find and update updateUI function to include WIN display
$inUpdateUI = $false
$newLines = @()
for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    
    # Add WIN display logic after level display in updateUI
    if ($line -match '^\s+if \(levelEl\) levelEl\.textContent = currentLevel;') {
        $newLines += $line
        # Add WIN display code
        $newLines += ""
        $newLines += "    // Update WIN count for two-player mode"
        $newLines += "    if (gameMode === 'multi') {"
        $newLines += "        const winsEl = document.getElementById(prefix + 'wins');"
        $newLines += "        const totalWins = player.id === 0 ? p1TotalWins : p2TotalWins;"
        $newLines += "        if (winsEl) winsEl.textContent = totalWins;"
        $newLines += "    }"
        continue
    }
    
    # Update initGame to control P2 UI visibility
    if ($line -match 'document\.querySelectorAll.*\.player-info.*forEach.*el.*display.*block') {
        $newLines += "        // Show P2 UI and WIN boxes"
        $newLines += "        document.getElementById('p2UI').style.display = 'flex';"
        $newLines += "        document.getElementById('p1-winsBox').style.display = 'block';"
        $newLines += "        document.getElementById('p2-winsBox').style.display = 'block';"
        continue
    }
    
    if ($line -match 'document\.querySelectorAll.*\.player-info.*forEach.*el.*display.*none') {
        $newLines += "        // Hide P2 UI and WIN boxes"
        $newLines += "        document.getElementById('p2UI').style.display = 'none';"
        $newLines += "        document.getElementById('p1-winsBox').style.display = 'none';"
        $newLines += "        document.getElementById('p2-winsBox').style.display = 'none';"
        continue
    }
    
    # Update version number
    if ($line -match 'Game Version: v2\.8') {
        $newLines += $line -replace 'v2\.8', 'v2.9'
        continue
    }
    
    # Update endLevel to call updateUI after updating totals
    if ($line -match '^\s+p2TotalWins \+= p2\.wins;') {
        $newLines += $line
        $newLines += ""
        $newLines += "    // Update WIN displays"
        $newLines += "    updateUI();"
        continue
    }
    
    $newLines += $line
}

# Save the updated content
$newLines | Set-Content $scriptPath -Encoding UTF8

Write-Host "Game logic updated successfully!"
Write-Host "- Added WIN display to updateUI function"
Write-Host "- Updated P2 UI visibility controls"
Write-Host "- Added WIN display updates in endLevel"
Write-Host "- Updated version to v2.9"

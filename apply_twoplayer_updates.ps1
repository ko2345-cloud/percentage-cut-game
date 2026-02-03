$scriptPath = "c:\Users\tak\Desktop\Percentage_Cut\script.js"
$content = Get-Content $scriptPath -Raw -Encoding UTF8

# 1. Add translation keys after the translations object
$translationInsert = @'

// Two-player mode translations
translations.zh.wins = "Win";
translations.zh.selectMode = "選擇模式：";
translations.zh.singlePlayer = "單人模式";
translations.zh.twoPlayers = "雙人模式";
translations.zh.player1Wins = "玩家1 獲勝！";
translations.zh.player2Wins = "玩家2 獲勝！";
translations.zh.draw = "平手！";
translations.zh.gameOver = "遊戲結束";
translations.zh.finalScore = "最終分數";

translations.en.wins = "Win";
translations.en.selectMode = "Select Mode:";
translations.en.singlePlayer = "Single Player";
translations.en.twoPlayers = "Two Players";
translations.en.player1Wins = "Player 1 Wins!";
translations.en.player2Wins = "Player 2 Wins!";
translations.en.draw = "Draw!";
translations.en.gameOver = "Game Over";
translations.en.finalScore = "Final Score";

'@

# Add translation keys if not already present
if ($content -notmatch "translations\.zh\.wins") {
    $content = $content -replace "(\};[\r\n]+let currentLanguage)", "$translationInsert`r`nlet currentLanguage"
    Write-Host "Added translation keys"
}

# 2. Update version number
$content = $content -replace "Game Version: v2\.8", "Game Version: v2.9"

# 3. Fix initGame to show/hide P2 UI
# Find and replace the multi-player UI setup
$oldMultiSetup = 'document.querySelectorAll\(.player-info.\).forEach\(el => el.style.display = .block.\);'
$newMultiSetup = @'
        // Show P2 UI and WIN boxes
        document.getElementById('p2UI').style.display = 'flex';
        document.getElementById('p1-winsBox').style.display = 'block';
        document.getElementById('p2-winsBox').style.display = 'block';
'@

$content = $content -replace $oldMultiSetup, $newMultiSetup

$oldSingleSetup = 'document.querySelectorAll\(.player-info.\).forEach\(el => el.style.display = .none.\);'
$newSingleSetup = @'
        // Hide P2 UI and WIN boxes
        document.getElementById('p2UI').style.display = 'none';
        document.getElementById('p1-winsBox').style.display = 'none';
        document.getElementById('p2-winsBox').style.display = 'none';
'@

$content = $content -replace $oldSingleSetup, $newSingleSetup

# 4. Fix split-screen line selector  
$content = $content -replace "document\.querySelector\('.split-screen-line'\)", "document.getElementById('splitLine')"

# 5. Add WIN display to updateUI function
$updateUIWinCode = @'

    // Update WIN count for two-player mode
    if (gameMode === 'multi') {
        const winsEl = document.getElementById(prefix + 'wins');
        const totalWins = player.id === 0 ? p1TotalWins : p2TotalWins;
        if (winsEl) winsEl.textContent = totalWins;
    }
}
'@

# Replace the end of updateUI function
$content = $content -replace "(\s+if \(levelEl\) levelEl\.textContent = currentLevel;[\r\n]+\})", "`$1`r`n$updateUIWinCode"

# 6. Add updateUI call after WIN total updates in endLevel
$content = $content -replace "(p2TotalWins \+= p2\.wins;)", "`$1`r`n`r`n    // Update WIN displays`r`n    updateUI();"

# Save
Set-Content $scriptPath -Value $content -Encoding UTF8 -NoNewline

Write-Host "Two-player mode updates applied successfully!"
Write-Host "- Translation keys added"
Write-Host "- Version updated to v2.9"
Write-Host "- P2 UI visibility controls updated"
Write-Host "- WIN display logic added"
Write-Host "- Split-screen line selector fixed"

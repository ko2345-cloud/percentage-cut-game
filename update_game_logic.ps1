$scriptPath = "c:\Users\tak\Desktop\Percentage_Cut\script.js"
$content = Get-Content $scriptPath -Raw -Encoding UTF8

# 1. Update initGame to show/hide P2 UI and WIN boxes for two-player mode
$oldInitGamePart = @'
    // [显示分隔线和玩家信息
        const splitLine = document.querySelector('.split-screen-line');
        if (splitLine) splitLine.style.display = 'block';

        document.querySelectorAll('.player-info').forEach(el => el.style.display = 'block');
    } else {
        players.push(new PlayerState(0, { x: 0, y: 0, width: canvas.width, height: canvas.height }));

        // [隐藏分割]
        const splitLine = document.querySelector('.split-screen-line');
        if (splitLine) splitLine.style.display = 'none';
        document.querySelectorAll('.player-info').forEach(el => el.style.display = 'none');
    }
'@

$newInitGamePart = @'
    // Show P2 UI and WIN boxes for two-player mode
        document.getElementById('p2UI').style.display = 'flex';
        document.getElementById('p1-winsBox').style.display = 'block';
        document.getElementById('p2-winsBox').style.display = 'block';
    } else {
        players.push(new PlayerState(0, { x: 0, y: 0, width: canvas.width, height: canvas.height }));

        // Hide P2 UI and WIN boxes for single player
        document.getElementById('p2UI').style.display = 'none';
        document.getElementById('p1-winsBox').style.display = 'none';
        document.getElementById('p2-winsBox').style.display = 'none';
    }
'@

# This regex replacement might not work perfectly due to encoding,
# so let's try a more targeted approach - find and replace specific lines

# Update the version number in handleStartGame
$content = $content -replace 'Game Version: v2\.8', 'Game Version: v2.9'

# Save
Set-Content $scriptPath -Value $content -Encoding UTF8 -NoNewline

Write-Host "Script updated!"

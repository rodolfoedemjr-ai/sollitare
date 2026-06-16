(function() {
    var d = document;

    var deck = [];
    var piles = {
        stock: [], waste: [],
        spades: [], hearts: [], diamonds: [], clubs: [],
        'tab-1': [], 'tab-2': [], 'tab-3': [], 'tab-4': [], 'tab-5': [], 'tab-6': [], 'tab-7': []
    };

    var valuesMap = { 'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13 };
    var cardRanks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    var cardSuits = ['spade','heart','diamond','club'];

    var movesCount = 0;
    var currentScore = 0;
    var timerInterval = null;
    var secondsElapsed = 0;
    var gameStarted = false;
    var historyLog = [];
    var autoWinInterval = null;
    var draggedData = null;

    // Fixed draw cycle sequence trackers
    var clickCycleCount = 1; 

    // Victory animation rendering state trackers
    var victoryAnimationTimer = null;
    var activeVictoryCards = [];

    var $titleScreen   = d.getElementById('title-screen');
    var $gameContainer = d.getElementById('game-container');
    var $timerSpan     = d.querySelector('.timer span');
    var $movesSpan     = d.querySelector('.move-count span');
    var $scoreSpan     = d.querySelector('.score span');
    var $undoBtn       = d.getElementById('undo-btn');
    var $hintBtn       = d.getElementById('hint-btn');
    var $autoWinBtn    = d.getElementById('auto-win');
    
    var $tableScaleWrapper = d.getElementById('table-scale-wrapper');
    var $parallaxBgLayer   = d.getElementById('parallax-bg-layer');
    var $victoryCanvas     = d.getElementById('victory-canvas-holder');

    window.addEventListener('DOMContentLoaded', function() {
        if ($titleScreen) {
            $titleScreen.addEventListener('click', function() {
                $titleScreen.classList.add('hidden');
                $gameContainer.style.display = 'block';
                initGame();
            });
        }
        setupGlobalEvents();
    });

    // --- 1. THE AUTOMATED PARALLAX SCALING CORE ---
    function executeParallaxScalingEngine() {
        if (!$tableScaleWrapper || !$parallaxBgLayer) return;
        
        var maxStackDepth = 0;
        for (var i = 1; i <= 7; i++) {
            var currentLength = piles['tab-' + i].length;
            if (currentLength > maxStackDepth) {
                maxStackDepth = currentLength;
            }
        }

        var threshold = 10; 
        var targetScale = 1.0;

        if (maxStackDepth > threshold) {
            // Smoothly decrease scaling step rules for each card past the threshold
            var oversizedCards = maxStackDepth - threshold;
            targetScale = Math.max(0.72, 1.0 - (oversizedCards * 0.028));
        }

        // Anchor card board transformations down cleanly
        $tableScaleWrapper.style.transform = 'scale(' + targetScale + ')';
        
        // Counter-scale the background to simulate deep landscape tracking
        var bgParallaxScale = 1.0 + ((1.0 - targetScale) * 0.45);
        $parallaxBgLayer.style.transform = 'scale(' + bgParallaxScale + ')';
    }

    function initGame() {
        if(timerInterval) { clearInterval(timerInterval); timerInterval = null; }
        if(autoWinInterval) { clearInterval(autoWinInterval); autoWinInterval = null; }
        clearVictoryAnimation();
        
        secondsElapsed = 0; movesCount = 0; currentScore = 0; gameStarted = false; historyLog = [];
        clickCycleCount = 1; 
        
        $timerSpan.textContent = "00:00";
        updateScoreBoard();
        buildDeck();
        shuffleDeck();
        dealCards();
        renderAllPiles();
    }

    function buildDeck() {
        deck = [];
        for (var key in piles) { piles[key] = []; }
        cardSuits.forEach(function(s) {
            cardRanks.forEach(function(r) {
                deck.push({ rank: r, suit: s, isUp: false, id: s + '_' + r });
            });
        });
    }

    function shuffleDeck() {
        for (var i = deck.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = deck[i]; deck[i] = deck[j]; deck[j] = temp;
        }
    }

    function dealCards() {
        var idx = 0;
        for (var i = 1; i <= 7; i++) {
            for (var j = i; j <= 7; j++) {
                var card = deck[idx++];
                if (j === i) card.isUp = true;
                piles['tab-' + j].push(card);
            }
        }
        while (idx < deck.length) { piles['stock'].push(deck[idx++]); }
    }

    function renderAllPiles() {
        for (var key in piles) { renderPile(key); }
        checkAutoWinEligibility();
        executeParallaxScalingEngine();
    }

    function renderPile(pileKey) {
        var $ul = d.querySelector('[data-pile="' + pileKey + '"] ul');
        if (!$ul) return;
        $ul.innerHTML = '';

        var arr = piles[pileKey];
        if (pileKey === 'stock') {
            d.getElementById('stock').setAttribute('data-empty', arr.length === 0 ? 'true' : 'false');
        }

        var baseOffset = 32;
        if (pileKey.indexOf('tab-') === 0 && arr.length > 8) {
            baseOffset = Math.max(14, Math.floor(240 / arr.length));
        }

        arr.forEach(function(card, index) {
            var $tpl = d.querySelector('.templates li[data-rank="' + card.rank + '"]');
            if (!$tpl) return;

            var $li = $tpl.cloneNode(true);
            $li.className = 'card ' + card.suit;
            $li.setAttribute('data-id', card.id);
            $li.setAttribute('data-index', index);
            $li.setAttribute('data-origin-pile', pileKey);

            if (pileKey.indexOf('tab-') === 0) {
                $li.style.setProperty('--card-offset', (index * baseOffset) + 'px');
            }

            if (pileKey === 'waste') {
                var totalCards = arr.length;
                var visibleCount = Math.min(3, totalCards);
                var startingIndex = totalCards - visibleCount;

                if (index >= startingIndex) {
                    var visiblePos = index - startingIndex; 
                    $li.style.setProperty('--waste-offset', (visiblePos * 26) + 'px');
                } else {
                    $li.style.setProperty('--waste-offset', '0px');
                }
            }

            if (card.isUp) {
                $li.classList.add('up');
                if (pileKey === 'waste' && index !== arr.length - 1) {
                    $li.setAttribute('draggable', 'false');
                } else {
                    $li.setAttribute('draggable', 'true');
                    attachDragEvents($li);
                    $li.addEventListener('dblclick', handleCardDoubleClick);
                }
            } else {
                $li.setAttribute('draggable', 'false');
            }

            $ul.appendChild($li);
        });
    }

    function handleCardDoubleClick(e) {
        e.stopPropagation();
        var origin = this.getAttribute('data-origin-pile');
        var idx = parseInt(this.getAttribute('data-index'), 10);
        var arr = piles[origin];

        if (idx !== arr.length - 1) return;
        var card = arr[idx];

        var foundations = ['spades', 'hearts', 'diamonds', 'clubs'];
        for (var i = 0; i < foundations.length; i++) {
            if (isValidMove(card, foundations[i])) {
                executeMoveData(origin, idx, foundations[i]);
                return;
            }
        }

        for (var j = 1; j <= 7; j++) {
            var tabTarget = 'tab-' + j;
            if (tabTarget === origin) continue;
            if (isValidMove(card, tabTarget)) {
                executeMoveData(origin, idx, tabTarget);
                return;
            }
        }
    }

    function isValidMove(card, targetKey) {
        var targetPile = piles[targetKey];
        var topCard = targetPile.length > 0 ? targetPile[targetPile.length - 1] : null;

        if (['spades', 'hearts', 'diamonds', 'clubs'].indexOf(targetKey) !== -1) {
            if (card.suit + 's' !== targetKey) return false;
            if (!topCard) return card.rank === 'A';
            return valuesMap[card.rank] === valuesMap[topCard.rank] + 1;
        }

        if (targetKey.indexOf('tab-') === 0) {
            if (!topCard) return card.rank === 'K';
            if (!topCard.isUp) return false;
            var targetIsRed = (topCard.suit === 'heart' || topCard.suit === 'diamond');
            var currentIsRed = (card.suit === 'heart' || card.suit === 'diamond');
            return (targetIsRed !== currentIsRed) && (valuesMap[card.rank] === valuesMap[topCard.rank] - 1);
        }
        return false;
    }

    function executeMoveData(fromKey, index, toKey) {
        saveHistory();
        var movingSlice = piles[fromKey].splice(index);
        piles[toKey] = piles[toKey].concat(movingSlice);

        if (fromKey.indexOf('tab-') === 0 && piles[fromKey].length > 0) {
            var flippedTop = piles[fromKey][piles[fromKey].length - 1];
            if (!flippedTop.isUp) { flippedTop.isUp = true; currentScore += 5; }
        }

        if (['spades', 'hearts', 'diamonds', 'clubs'].indexOf(toKey) !== -1) currentScore += 10;
        
        trackMoveActivity();
        renderPile(fromKey);
        renderPile(toKey);
        checkAutoWinEligibility();
        executeParallaxScalingEngine();
    }

    function trackMoveActivity() {
        if (!gameStarted) { gameStarted = true; startTimerEngine(); }
        movesCount++;
        updateScoreBoard();
        clearHintTrackers();
    }

    function startTimerEngine() {
        timerInterval = setInterval(function() {
            secondsElapsed++;
            var m = Math.floor(secondsElapsed / 60);
            var s = secondsElapsed % 60;
            $timerSpan.textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
        }, 1000);
    }

    function updateScoreBoard() {
        $movesSpan.textContent = movesCount;
        $scoreSpan.textContent = currentScore;
        $undoBtn.disabled = historyLog.length === 0;
    }

    function saveHistory() {
        historyLog.push({ 
            piles: JSON.stringify(piles), 
            movesCount: movesCount, 
            currentScore: currentScore,
            clickCycleCount: clickCycleCount 
        });
    }

    function triggerAIHint() {
        clearHintTrackers();
        var analyticalMoves = [];

        if (piles.waste.length > 0) {
            var wCard = piles.waste[piles.waste.length - 1];
            evaluateMoveDestinations('waste', piles.waste.length - 1, wCard, analyticalMoves);
        }

        for (var i = 1; i <= 7; i++) {
            var tKey = 'tab-' + i;
            piles[tKey].forEach(function(card, cIdx) {
                if (card.isUp) evaluateMoveDestinations(tKey, cIdx, card, analyticalMoves);
            });
        }

        if (analyticalMoves.length > 0) {
            analyticalMoves.sort(function(a, b) {
                var valA = (['spades','hearts','diamonds','clubs'].indexOf(a.to) !== -1) ? 2 : 1;
                var valB = (['spades','hearts','diamonds','clubs'].indexOf(b.to) !== -1) ? 2 : 1;
                return valB - valA;
            });
            var targetMove = analyticalMoves[0];
            var $cardEl = d.querySelector('[data-origin-pile="' + targetMove.from + '"][data-id="' + targetMove.id + '"]');
            var $pileEl = d.querySelector('[data-pile="' + targetMove.to + '"]');
            if ($cardEl) $cardEl.classList.add('hint-source');
            if ($pileEl) $pileEl.classList.add('hint-target');
        }
    }

    function evaluateMoveDestinations(fKey, idx, card, list) {
        var targets = ['spades', 'hearts', 'diamonds', 'clubs', 'tab-1', 'tab-2', 'tab-3', 'tab-4', 'tab-5', 'tab-6', 'tab-7'];
        targets.forEach(function(tKey) {
            if (fKey === tKey) return;
            if (fKey.indexOf('tab-') === 0 && tKey.indexOf('tab-') === 0 && idx === 0 && piles[tKey].length === 0 && card.rank === 'K') return;
            if (isValidMove(card, tKey)) {
                list.push({ from: fKey, id: card.id, to: tKey });
            }
        });
    }

    function clearHintTrackers() {
        d.querySelectorAll('.card.hint-source').forEach(function(c) { c.classList.remove('hint-source'); });
        d.querySelectorAll('.pile.hint-target').forEach(function(p) { p.classList.remove('hint-target'); });
    }

    function checkVictoryStatus() {
        if (piles.spades.length === 13 && piles.hearts.length === 13 && piles.diamonds.length === 13 && piles.clubs.length === 13) {
            if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
            startVictoryWaterfallAnimation();
        }
    }

    function setupGlobalEvents() {
        // --- 2. FIXED STOCK/WASTE PILE CYCLE (1, 2, 3 CYCLE DRIVER) ---
        d.getElementById('stock').addEventListener('click', function() {
            if (piles.stock.length === 0) {
                if (piles.waste.length === 0) return;
                saveHistory();
                
                // Flip the waste pile cards completely back over into the stock deck
                piles.stock = piles.waste.reverse().map(function(c) { c.isUp = false; return c; });
                piles.waste = [];
                
                // Reset the drawing count index cleanly back to card drawing position 1
                clickCycleCount = 1; 
                
                trackMoveActivity();
                renderPile('stock'); 
                renderPile('waste');
            } else {
                saveHistory();
                
                // Pull exactly what the current draw cycle position requests
                var cardsToDraw = Math.min(clickCycleCount, piles.stock.length);
                for (var i = 0; i < cardsToDraw; i++) {
                    var card = piles.stock.pop();
                    card.isUp = true;
                    piles.waste.push(card);
                }

                // Advance cycle pointer, loop back around when exceeding 3
                clickCycleCount++;
                if (clickCycleCount > 3) {
                    clickCycleCount = 1;
                }

                trackMoveActivity();
                renderPile('stock'); 
                renderPile('waste');
            }
        });

        d.querySelectorAll('.pile').forEach(function($zone) {
            $zone.addEventListener('dragover', function(e) { e.preventDefault(); });
            $zone.addEventListener('drop', function(e) {
                e.preventDefault();
                if (!draggedData) return;
                var target = this.getAttribute('data-pile');
                var source = draggedData.from;
                var sIdx = draggedData.idx;

                if (target === source) return;
                if (isValidMove(piles[source][sIdx], target)) {
                    executeMoveData(source, sIdx, target);
                }
            });
        });

        $undoBtn.addEventListener('click', function() {
            if (historyLog.length === 0) return;
            var snapshot = historyLog.pop();
            piles = JSON.parse(snapshot.piles);
            movesCount = snapshot.movesCount;
            currentScore = snapshot.currentScore;
            clickCycleCount = snapshot.clickCycleCount || 1; 

            updateScoreBoard();
            renderAllPiles();
            clearHintTrackers();
        });

        if ($hintBtn) $hintBtn.addEventListener('click', triggerAIHint);
        $autoWinBtn.addEventListener('click', triggerCascadeSolver);
    }

    function attachDragEvents($el) {
        $el.addEventListener('dragstart', function(e) {
            var origin = this.getAttribute('data-origin-pile');
            var idx = parseInt(this.getAttribute('data-index'), 10);
            draggedData = { from: origin, idx: idx };
            this.classList.add('dragging');
            e.dataTransfer.setData('text/plain', '');

            var sibs = this.parentNode.children;
            for (var i = idx + 1; i < sibs.length; i++) {
                sibs[i].classList.add('drag-source');
            }
        });

        $el.addEventListener('dragend', function() {
            this.classList.remove('dragging');
            d.querySelectorAll('.drag-source').forEach(function(c) { c.classList.remove('drag-source'); });
            draggedData = null;
        });
    }

    function checkAutoWinEligibility() {
        var hiddenCount = 0;
        for (var i = 1; i <= 7; i++) {
            piles['tab-' + i].forEach(function(c) { if (!c.isUp) hiddenCount++; });
        }
        if (piles.stock.length === 0 && piles.waste.length === 0 && hiddenCount === 0) {
            var activeRemaining = false;
            for (var j = 1; j <= 7; j++) {
                if (piles['tab-' + j].length > 0) activeRemaining = true;
            }
            $autoWinBtn.style.display = activeRemaining ? 'inline-block' : 'none';
            if (!activeRemaining) {
                checkVictoryStatus();
            }
        } else {
            $autoWinBtn.style.display = 'none';
        }
    }

    function triggerCascadeSolver() {
        if (autoWinInterval) return;
        $autoWinBtn.style.display = 'none';
        var foundations = ['spades', 'hearts', 'diamonds', 'clubs'];

        autoWinInterval = setInterval(function() {
            var actionTaken = false;
            for (var i = 1; i <= 7; i++) {
                var tKey = 'tab-' + i;
                var stack = piles[tKey];
                if (stack.length > 0) {
                    var targetCard = stack[stack.length - 1];
                    for (var f = 0; f < foundations.length; f++) {
                        if (isValidMove(targetCard, foundations[f])) {
                            executeMoveData(tKey, stack.length - 1, foundations[f]);
                            actionTaken = true; break;
                        }
                    }
                }
                if (actionTaken) break;
            }
            if (!actionTaken) {
                clearInterval(autoWinInterval); autoWinInterval = null;
                checkVictoryStatus();
            }
        }, 120);
    }

    // --- 3. THE VICTORY WATERFALL PHYSICS ANIMATION SYSTEM ---
    function startVictoryWaterfallAnimation() {
        clearVictoryAnimation();
        
        var foundations = ['king', 'queen', 'jack', '10', '9', '8', '7', '6', '5', '4', '3', '2', 'A'];
        var targetSuits = ['spades', 'hearts', 'diamonds', 'clubs'];
        var cascadeCardQueue = [];

        // Build a physics-ready queue order starting from the top Kings descending
        foundations.forEach(function(rank) {
            targetSuits.forEach(function(suitName) {
                var singleSuit = suitName.substring(0, suitName.length - 1); // strip trailing 's'
                cascadeCardQueue.push({ rank: rank, suit: singleSuit, suitPile: suitName });
            });
        });

        var currentCardQueueIndex = 0;
        var loopStepCount = 0;

        victoryAnimationTimer = setInterval(function() {
            // Spawn next card in sequence every 12 physics calculation steps
            if (loopStepCount % 12 === 0 && currentCardQueueIndex < cascadeCardQueue.length) {
                var spawnTarget = cascadeCardQueue[currentCardQueueIndex];
                var fndPileElement = d.querySelector('[data-pile="' + spawnTarget.suitPile + '"]');
                if (fndPileElement) {
                    var coordinates = fndPileElement.getBoundingClientRect();
                    
                    // Create an animated rendering copy outside standard DOM rules
                    var $animEl = d.createElement('div');
                    $animEl.className = 'victory-anim-card';
                    
                    // Style matching current deck art assets
                    $animEl.style.backgroundImage = "url('cards/classic/card_face_bg.png')";
                    
                    // Assemble mini rank markup patterns inside the physics block
                    $animEl.innerHTML = '<div style="color:' + ((spawnTarget.suit==='heart'||spawnTarget.suit==='diamond')?'#d61c1c':'#1c1c1c') + ';padding:4px;font-weight:bold;font-size:1.1rem;">' + spawnTarget.rank + '</div>';
                    
                    $victoryCanvas.appendChild($animEl);

                    activeVictoryCards.push({
                        element: $animEl,
                        x: coordinates.left,
                        y: coordinates.top,
                        vx: (Math.random() * 5) + 2 * (Math.random() > 0.5 ? 1 : -1), // Random horizontal bounce directions
                        vy: -3 - (Math.random() * 4), // Initial upward jump thrust values
                        alive: true
                    });
                }
                currentCardQueueIndex++;
            }

            // Apply gravity physics updates to all spawned canvas card copies
            var viewportWidth = window.innerWidth;
            var viewportHeight = window.innerHeight;

            activeVictoryCards.forEach(function(pCard) {
                if (!pCard.alive) return;

                pCard.vy += 0.38; // Gravity step asset constant
                pCard.x += pCard.vx;
                pCard.y += pCard.vy;

                // Ground plane boundary collision checking formulas
                if (pCard.y + 145 >= viewportHeight) {
                    pCard.y = viewportHeight - 145;
                    pCard.vy = -pCard.vy * 0.82; // Elastic bounce reduction conversion matrix
                    if (Math.abs(pCard.vy) < 1.5) pCard.vy = 0;
                }

                // Side wall containment check rules
                if (pCard.x <= 0 || pCard.x + 104 >= viewportWidth) {
                    pCard.vx = -pCard.vx;
                }

                pCard.element.style.left = pCard.x + 'px';
                pCard.element.style.top = pCard.y + 'px';

                // Cleanup components off screen edges to maintain hardware rendering performance
                if (pCard.x < -150 || pCard.x > viewportWidth + 150) {
                    pCard.alive = false;
                    pCard.element.remove();
                }
            });

            loopStepCount++;

            // Turn off loop automatically after execution concludes or when user resets the match
            if (currentCardQueueIndex >= cascadeCardQueue.length && activeVictoryCards.every(function(c){ return !c.alive; })) {
                clearVictoryAnimation();
                alert("Victory Achieved!");
                initGame();
            }
        }, 16);
    }

    function clearVictoryAnimation() {
        if (victoryAnimationTimer) { clearInterval(victoryAnimationTimer); victoryAnimationTimer = null; }
        if ($victoryCanvas) $victoryCanvas.innerHTML = '';
        activeVictoryCards = [];
    }
})();
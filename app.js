class ChineseApp {
    constructor() {
        this.audioUnlocked = false;

        // Special iOS Voice Loader
        const loadVoices = () => {
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                console.log("iPhone Voices Loaded:", voices.length);
            }
        };
        window.speechSynthesis.onvoiceschanged = loadVoices;
        loadVoices();

        // One-time tap to unlock high-quality audio on iPhone
        document.addEventListener('touchstart', () => {
            if (this.audioUnlocked) return;
            const silence = new SpeechSynthesisUtterance('');
            window.speechSynthesis.speak(silence);
            this.audioUnlocked = true;
        }, { once: true });

        window.speechSynthesis.getVoices(); 
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
        }

        document.body.addEventListener('pointerdown', () => {
            if (this.audioUnlocked) return;
            const unlockMsg = new SpeechSynthesisUtterance('');
            unlockMsg.volume = 0; // Silent play
            window.speechSynthesis.speak(unlockMsg);
            this.audioUnlocked = true;
        }, { once: true });

        this.data = { books: {} };
        
        this.state = {
            selectedBooks: new Set(),
            selectedLessons: new Set(),
            currentMode: 'flashcards', 
            isReviewMode: false,
            studyQueue: [], 
            currentIndex: 0, 
            score: 0,
            progress: this.loadProgress(),
            history: [], 
            isAutoPlaying: false, 
            isSentenceAutoPlaying: false, 
            outlineHidden: false, 
            isAnimating: false,
            autoAudio: false 
        };
        
        this.swipeState = { isDragging: false, startX: 0, currentX: 0, startTime: 0 };
        this.slideshowTimeout = null;
        this.sentenceSlideshowTimeout = null;
        this.hanziWriter = null;
        
        this.init();
    }

    init() {
        this.processData();
        this.setupEventListeners();
        this.applyTheme(); 
        
        const firstBook = Object.keys(this.data.books)[0];
        if (firstBook) {
            this.state.selectedBooks.add(firstBook);
            this.state.selectedLessons.add("1"); 
        }
        
        this.renderChips();
        this.applyCourseSelection(); 
    }

    processData() {
        const ensurePath = (bId, lId) => {
            if (!this.data.books[bId]) this.data.books[bId] = { lessons: {} };
            if (!this.data.books[bId].lessons[lId]) this.data.books[bId].lessons[lId] = { vocab: [], sentences: [] };
        };

        if (window.new_vocab) {
            window.new_vocab.forEach(v => {
                let bId = parseInt(v.book_id) || 1;
                let lId = parseInt(v.lesson_id) || 0;
                ensurePath(bId, lId);
                this.data.books[bId].lessons[lId].vocab.push(v);
            });
        }
        if (window.sentences) {
            window.sentences.forEach(s => {
                let bId = parseInt((s.book_id || "B1").replace('B', '')) || 1;
                let lId = parseInt(s.lesson_id) || 0;
                ensurePath(bId, lId);
                this.data.books[bId].lessons[lId].sentences.push(s);
            });
        }
    }

    playSound(type) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        const now = ctx.currentTime;
        if (type === 'correct') { 
            osc.type = 'sine'; osc.frequency.setValueAtTime(523.25, now); osc.frequency.setValueAtTime(659.25, now + 0.1); 
            gain.gain.setValueAtTime(0.5, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now); osc.stop(now + 0.3);
        } else if (type === 'wrong') { 
            osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, now); osc.frequency.setValueAtTime(120, now + 0.15);
            gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now); osc.stop(now + 0.3);
        }
    }

    applyTheme() {
        const savedTheme = localStorage.getItem('aladsTheme') || 'default';
        this.changeTheme(savedTheme);
        const dropdown = document.getElementById('theme-selector');
        if (dropdown) dropdown.value = savedTheme;
    }

    changeTheme(themeName) {
        document.body.className = ''; 
        if (themeName !== 'default') {
            document.body.classList.add(`theme-${themeName}`);
        }
        localStorage.setItem('aladsTheme', themeName);
        if(this.state.currentMode === 'writing') this.renderWritingChar();
    }

    renderChips() {
        const bookContainer = document.getElementById('book-chips');
        if (bookContainer) bookContainer.innerHTML = '';
        
        Object.keys(this.data.books).forEach(bId => {
            const chip = document.createElement('div');
            chip.className = `chip ${this.state.selectedBooks.has(bId) ? 'active' : ''}`;
            chip.innerText = `📖 Book ${bId}`;
            chip.onclick = () => {
                if (this.state.selectedBooks.has(bId)) this.state.selectedBooks.delete(bId);
                else this.state.selectedBooks.add(bId);
                this.applyCourseSelection(); this.renderChips();
            };
            if (bookContainer) bookContainer.appendChild(chip);
        });

        let availableLessons = new Set();
        this.state.selectedBooks.forEach(bId => {
            if (this.data.books[bId] && this.data.books[bId].lessons) {
                Object.keys(this.data.books[bId].lessons).forEach(lId => availableLessons.add(parseInt(lId)));
            }
        });

        const lessonContainer = document.getElementById('lesson-chips');
        if (lessonContainer) lessonContainer.innerHTML = '';
        
        Array.from(availableLessons).sort((a, b) => a - b).forEach(lId => {
            const strId = lId.toString();
            const chip = document.createElement('div');
            chip.className = `chip ${this.state.selectedLessons.has(strId) ? 'active' : ''}`;
            chip.innerText = `${lId}`;
            chip.onclick = () => {
                if (this.state.selectedLessons.has(strId)) this.state.selectedLessons.delete(strId);
                else this.state.selectedLessons.add(strId);
                this.applyCourseSelection(); this.renderChips();
            };
            if (lessonContainer) lessonContainer.appendChild(chip);
        });
    }

    selectAllLessons() {
        let availableLessons = new Set();
        this.state.selectedBooks.forEach(bId => {
            Object.keys(this.data.books[bId].lessons).forEach(lId => availableLessons.add(parseInt(lId)));
        });
        let allSelected = true;
        availableLessons.forEach(lId => {
            if (!this.state.selectedLessons.has(lId.toString())) allSelected = false;
        });
        if (allSelected) {
            this.state.selectedLessons.clear(); 
        } else {
            availableLessons.forEach(lId => this.state.selectedLessons.add(lId.toString())); 
        }
        this.renderChips();
    }

    applyCourseSelection() {
        this.state.isReviewMode = false;
        if(window.innerWidth <= 800) this.toggleSidebar(); 
        if (this.state.currentMode === 'manage-review') this.renderManageReview();
        else this.loadCurrentMode();
        document.querySelectorAll('.control-group summary').forEach(s => {
            s.classList.add('flash-update');
            setTimeout(() => s.classList.remove('flash-update'), 400);
        });
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('mobile-overlay');
        if(sidebar) sidebar.classList.toggle('open');
        if(overlay) overlay.classList.toggle('active');
    }

    setMode(mode) {
        this.state.currentMode = mode;
        this.state.isReviewMode = false;
        if (this.state.isAutoPlaying) this.toggleAutoPlaySlideshow();
        if (this.state.isSentenceAutoPlaying) this.toggleSentenceSlideshow();

        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
        if (mode !== 'manage-review') {
            const activeBtn = document.getElementById(`btn-${mode}`);
            if (activeBtn) activeBtn.classList.add('active');
        }

        if(window.innerWidth <= 800) this.toggleSidebar(); 
        this.loadCurrentMode();
        
        const lessonSelector = document.getElementById('course-selector-container');
        if (lessonSelector) lessonSelector.style.display = 'block';
    }

    // --- BULLETPROOF REVIEW STARTER ---
    startReviewMode() {
        this.state.progress = this.loadProgress();

        if (!this.state.progress.reviewQueue || this.state.progress.reviewQueue.length === 0) {
            alert("Your review list is empty! Swipe left on some cards first.");
            return;
        }

        this.state.currentMode = 'flashcards';
        this.state.isReviewMode = true; 

        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById('btn-flashcards');
        if (activeBtn) activeBtn.classList.add('active');

        this.loadCurrentMode();
        
        const lessonSelector = document.getElementById('course-selector-container');
        if (lessonSelector) lessonSelector.style.display = 'none';
    }

    loadCurrentMode() {
        this.state.history = [];
        document.querySelectorAll('.study-view').forEach(v => v.classList.remove('active'));
        const curView = document.getElementById(`view-${this.state.currentMode}`);
        if(curView) curView.classList.add('active');

        if (this.state.currentMode === 'manage-review') {
            document.getElementById('current-title').innerText = "⚙️ Manage Study List";
            this.renderManageReview();
            return;
        }

        if (this.state.isReviewMode) {
            // Load exclusively from the review bucket!
            this.state.studyQueue = [...this.state.progress.reviewQueue].sort(() => Math.random() - 0.5);
            document.getElementById('current-title').innerText = "🔄 Review Deck";
        } else {
            let aggregatedVocab = [];
            let aggregatedSentences = [];
            this.state.selectedBooks.forEach(bId => {
                const book = this.data.books[bId];
                if (!book) return;
                this.state.selectedLessons.forEach(lId => {
                    if (book.lessons[lId]) {
                        aggregatedVocab.push(...book.lessons[lId].vocab);
                        aggregatedSentences.push(...book.lessons[lId].sentences);
                    }
                });
            });

            document.getElementById('current-title').innerText = `📚 TOCL-EASY`;
            
            if (this.state.currentMode === 'sentences') {
                this.state.studyQueue = [...aggregatedSentences].sort(() => Math.random() - 0.5);
            } else if (this.state.currentMode === 'writing') {
                let chars = new Set();
                aggregatedVocab.forEach(v => { 
                    const text = v.word || v.simplified || "";
                    for (let char of text) chars.add(char); 
                });
                this.state.studyQueue = Array.from(chars);
            } else {
                this.state.studyQueue = [...aggregatedVocab].sort(() => Math.random() - 0.5);
            }
        }

        this.state.currentIndex = 0;
        this.state.score = 0;
        this.updateProgressUI();
        this.renderCurrentItem();
    }

    renderManageReview() {
        let listUi = document.getElementById('review-list-ui');
        if(!listUi) return;
        
        listUi.innerHTML = '';
        if (!this.state.progress.reviewQueue || this.state.progress.reviewQueue.length === 0) {
            listUi.innerHTML = '<li style="justify-content:center; color: var(--text-muted);">List is empty! 🎈</li>';
        } else {
            this.state.progress.reviewQueue.forEach(item => {
                if (!item) return;
                const li = document.createElement('li');
                li.innerHTML = `
                    <div class="review-item-text">
                        ${item.word || item.simplified}
                        <span class="review-item-pinyin">${item.pinyin || ''}</span>
                    </div>
                    <button class="remove-btn">🗑️ Remove</button>
                `;
                const btn = li.querySelector('.remove-btn');
                if (btn) {
                    btn.addEventListener('click', () => this.removeFromReviewQueue(item.id || item.word));
                }
                listUi.appendChild(li);
            });
        }
    }

    removeFromReviewQueue(id) {
        this.state.progress.reviewQueue = this.state.progress.reviewQueue.filter(i => i && (i.id !== id && i.word !== id));
        this.saveProgress();
        this.renderManageReview();
    }

    clearReviewQueue() {
        if(confirm("Clear your Study Again list?")) {
            this.state.progress.reviewQueue = [];
            this.saveProgress();
            this.renderManageReview();
        }
    }
    
    addSelectedToReview() {
        alert("To add words to review, simply swipe left on them during a flashcard lesson!");
    }

    renderCurrentItem() {
        if (!this.state.studyQueue || this.state.studyQueue.length === 0) return this.showCompletion();
        if (this.state.currentIndex >= this.state.studyQueue.length) return this.showCompletion();

        if (this.state.currentMode === 'flashcards') this.renderFlashcard();
        if (this.state.currentMode === 'writing') this.renderWritingChar();
        if (this.state.currentMode === 'sentences') this.renderSentence();
        if (this.state.currentMode === 'quiz') this.renderQuiz();
        
        this.updateProgressUI();
    }

    nextItem() {
        this.saveSession();
        this.state.currentIndex++;
        if (this.state.currentIndex >= this.state.studyQueue.length) {
            this.showCompletion(); 
        } else {
            this.renderCurrentItem();
        }
    }
    prevItem() { if(this.state.currentIndex > 0) { this.state.currentIndex--; this.renderCurrentItem(); } }
    shuffleItems() { this.state.studyQueue.sort(() => Math.random() - 0.5); this.state.currentIndex = 0; this.renderCurrentItem(); }

    toggleAutoAudio() {
        this.state.autoAudio = !this.state.autoAudio;
        const text = this.state.autoAudio ? "🔊 Auto-Audio On" : "🔇 Auto-Audio Off";
        ['fc-auto-audio-btn', 'sn-auto-audio-btn'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) { btn.innerText = text; btn.classList.toggle('active', this.state.autoAudio); }
        });
    }

    playAudio(text, speedPref = 'normal') {
        if (!text || !window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        setTimeout(() => {
            const utterance = new SpeechSynthesisUtterance(text);
            let rate = 1.0; 
            if (speedPref === 'slow') rate = 0.5; 
            if (speedPref === 'fast') rate = 1.2;
            utterance.rate = rate;

            const voices = window.speechSynthesis.getVoices();
            let bestVoice = voices.find(v => v.lang.includes('zh-TW') || v.lang.includes('zh-HK'));
            if (!bestVoice) bestVoice = voices.find(v => v.lang.includes('zh'));
            
            if (bestVoice) utterance.voice = bestVoice;
            else utterance.lang = 'zh-TW';

            window.speechSynthesis.speak(utterance);
        }, 50);
    }

    playCurrentFlashcardAudio(event) {
        if (event) event.stopPropagation();
        const text = document.getElementById('fc-front-text').innerText;
        const speed = document.getElementById('fc-speed-select') ? document.getElementById('fc-speed-select').value : 'normal';
        this.playAudio(text, speed);
    }

    playSentenceAudio() {
        const text = document.getElementById('sn-chinese').innerText;
        const speed = document.getElementById('sn-speed-select').value;
        this.playAudio(text, speed);
    }

    renderFlashcard() {
        var item = this.state.studyQueue[this.state.currentIndex];
        if (!item) return; 
        
        document.getElementById('fc-front-text').innerText = item.word || item.simplified || "?";
        document.getElementById('fc-pinyin').innerText = item.pinyin || "";
        document.getElementById('fc-meaning').innerText = item.definition || item.meaning || item.english || "";
        
        let radBox = document.getElementById('fc-radical-box');
        let exBox = document.getElementById('fc-example-box');
        if(radBox) radBox.classList.add('hidden');
        if(exBox) exBox.classList.add('hidden');

        if (window.CHARS_DATA && radBox) {
            let firstChar = (item.word || item.simplified || "")[0];
            let charData = window.CHARS_DATA.find(c => c.hanzi === firstChar);
            if (charData && charData.radical) {
                radBox.innerHTML = `<strong>🧩 Radical Info:</strong> The character contains the radical <b>${charData.radical}</b>.`;
                radBox.classList.remove('hidden');
            }
        }

        if (window.sentences && exBox) {
            let searchWord = item.word || item.simplified;
            let found = window.sentences.find(s => s.sentence && s.sentence.includes(searchWord));
            if (found) {
                exBox.innerHTML = `<strong>📖 Example:</strong><br>${found.sentence}<br><span style="color:var(--text-muted); font-size: 0.9em;">${found.english}</span>`;
                exBox.classList.remove('hidden');
            }
        }
        
        var card = document.getElementById('flashcard');
        if (card) {
            card.classList.remove('is-flipped');
            setTimeout(() => {
                card.style.transition = 'none';
                card.style.transform = `translateX(0px) rotate(0deg)`;
                card.style.opacity = '1';
                card.style.boxShadow = 'none';
            }, 10);
        }

        if (this.state.autoAudio && !this.state.isAutoPlaying) this.playAudio(item.word || item.simplified, 'zh-CN');
    }

    flipCard() { 
        const card = document.getElementById('flashcard');
        if(card) card.classList.toggle('is-flipped'); 
    }

    // --- THE BULLETPROOF SWIPE ENGINE ---
    handleSwipe(direction) {
        const activeCard = document.getElementById('flashcard');
        const currentItem = this.state.studyQueue[this.state.currentIndex];
        
        // Safety net: don't crash if the queue is empty
        if (!currentItem) return;

        const getItemKey = item => item.id || item.word || item.simplified || JSON.stringify(item);
        const currentKey = getItemKey(currentItem);

        // Safety net: Force the bucket to exist
        if (!this.state.progress.reviewQueue) {
            this.state.progress.reviewQueue = [];
        }

        if (!this.state.history) this.state.history = [];
        this.state.history.push({ direction: direction, item: currentItem, index: this.state.currentIndex });

        if (direction === 'left') {
            if (!this.state.progress.reviewQueue.some(item => getItemKey(item) === currentKey)) {
                this.state.progress.reviewQueue.push(currentItem);
            }
        } else if (direction === 'right') {
            this.state.progress.reviewQueue = this.state.progress.reviewQueue.filter(item => getItemKey(item) !== currentKey);
        }
        
        this.saveProgress();
        this.saveSession();

        if (activeCard) {
            activeCard.style.transition = 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.4s ease';
            activeCard.style.opacity = '0';
            activeCard.style.transform = `translateX(${direction === 'left' ? '-150%' : '150%'}) rotate(${direction === 'left' ? '-20deg' : '20deg'})`;
        }

        setTimeout(() => {
            this.nextItem();
        }, 300);
    }

    undoLastSwipe() {
        if (!this.state.history || this.state.history.length === 0) return;
        const lastAction = this.state.history.pop();
        this.state.currentIndex = lastAction.index;
        this.renderCurrentItem();
    }

    toggleAutoPlaySlideshow() {
        this.state.isAutoPlaying = !this.state.isAutoPlaying;
        const btn = document.getElementById('auto-play-btn');
        if(!btn) return;
        if (this.state.isAutoPlaying) {
            btn.innerText = "⏸️ Stop Slideshow"; btn.classList.add('active');
            this.runSlideshowStep();
        } else {
            btn.innerText = "▶️ Slideshow"; btn.classList.remove('active');
            clearTimeout(this.slideshowTimeout);
        }
    }

    runSlideshowStep() {
        if (!this.state.isAutoPlaying || this.state.currentIndex >= this.state.studyQueue.length) {
            if (this.state.isAutoPlaying) this.toggleAutoPlaySlideshow();
            return;
        }

        let speedMultiplier = document.getElementById('fc-speed-select') && document.getElementById('fc-speed-select').value === 'slow' ? 1.5 : 1;
        const item = this.state.studyQueue[this.state.currentIndex];
        this.playAudio(item.word || item.simplified, 'zh-CN');

        this.slideshowTimeout = setTimeout(() => {
            if (!this.state.isAutoPlaying) return;
            this.flipCard();
            this.playAudio(item.definition || item.meaning || item.english, 'en-US');

            this.slideshowTimeout = setTimeout(() => {
                if (!this.state.isAutoPlaying) return;
                this.handleSwipe('right');
                this.slideshowTimeout = setTimeout(() => this.runSlideshowStep(), 800 * speedMultiplier);
            }, 2000 * speedMultiplier); 
        }, 1500 * speedMultiplier); 
    }

    renderWritingChar() {
        const char = this.state.studyQueue[this.state.currentIndex];
        const targetDiv = document.getElementById('character-target-div');
        if(!targetDiv) return;
        targetDiv.innerHTML = ''; 

        if (window.HanziWriter) {
            this.hanziWriter = HanziWriter.create('character-target-div', char, {
                width: 250, height: 250, padding: 15, drawingWidth: 55,
                strokeColor: '#000000', radicalColor: '#007bff', 
                showOutline: !this.state.outlineHidden
            });
            this.hanziWriter.quiz();
        }
    }

    toggleOutline() {
        if (!this.hanziWriter) return;
        this.state.outlineHidden = !this.state.outlineHidden;
        const btn = document.getElementById('toggle-outline-btn');
        if (this.state.outlineHidden) { this.hanziWriter.hideOutline(); btn.innerText = "👁️ Show Outline"; } 
        else { this.hanziWriter.showOutline(); btn.innerText = "🙈 Hide Outline"; }
    }

    renderSentence() {
        const s = this.state.studyQueue[this.state.currentIndex];
        if (!s) return;
        document.getElementById('sn-chinese').innerText = s.sentence || "";
        document.getElementById('sn-pinyin').innerText = s.pinyin || "";
        document.getElementById('sn-english').innerText = s.english || "";
        document.getElementById('sn-english').classList.add('hidden');
        document.getElementById('reveal-translation-btn').style.display = 'inline-block';
        if (this.state.autoAudio && !this.state.isSentenceAutoPlaying) this.playAudio(s.sentence, 'zh-CN');
    }

    revealSentence() {
        document.getElementById('sn-english').classList.remove('hidden');
        document.getElementById('reveal-translation-btn').style.display = 'none';
    }

    toggleSentenceSlideshow() {
        this.state.isSentenceAutoPlaying = !this.state.isSentenceAutoPlaying;
        const btn = document.getElementById('sn-auto-play-btn');
        if(!btn) return;
        if (this.state.isSentenceAutoPlaying) {
            btn.innerText = "⏸️ Stop Slideshow"; btn.classList.add('active');
            this.runSentenceSlideshowStep();
        } else {
            btn.innerText = "▶️ Slideshow"; btn.classList.remove('active');
            clearTimeout(this.sentenceSlideshowTimeout);
        }
    }

    runSentenceSlideshowStep() {
        if (!this.state.isSentenceAutoPlaying || this.state.currentIndex >= this.state.studyQueue.length) {
            if (this.state.isSentenceAutoPlaying) this.toggleSentenceSlideshow();
            return;
        }
        const s = this.state.studyQueue[this.state.currentIndex];
        this.playAudio(s.sentence, 'zh-CN', () => {
            this.sentenceSlideshowTimeout = setTimeout(() => {
                if (!this.state.isSentenceAutoPlaying) return;
                this.revealSentence(); 
                this.playAudio(s.english, 'en-US', () => {
                    this.sentenceSlideshowTimeout = setTimeout(() => {
                        if (!this.state.isSentenceAutoPlaying) return;
                        this.nextItem(); this.runSentenceSlideshowStep();
                    }, 3000);
                });
            }, 1200);
        });
    }

    renderQuiz() {
        var item = this.state.studyQueue[this.state.currentIndex];
        if (!item) return;

        var qType = document.getElementById('qz-q-type') ? document.getElementById('qz-q-type').value : 'zh';
        var aType = document.getElementById('qz-a-type') ? document.getElementById('qz-a-type').value : 'mc';
        
        var scoreUi = document.getElementById('quiz-score-ui');
        if (scoreUi) scoreUi.innerText = `🏆 Score: ${this.state.score || 0} / ${this.state.studyQueue.length}`;

        var questionText = qType === 'zh' ? (item.word || item.simplified) : (qType === 'py' ? item.pinyin : (item.definition || item.english));
        var correctMeaning = qType === 'zh' ? ((aType === 'mc-py') ? item.pinyin : (item.definition || item.english)) : (item.word || item.simplified);
        
        document.getElementById('qz-word').innerText = questionText;
        
        var optionsContainer = document.getElementById('qz-options');
        if(optionsContainer) optionsContainer.innerHTML = ''; 

        if (aType !== 'type' && optionsContainer) {
            optionsContainer.style.display = 'grid'; 
            var options = [item];
            while (options.length < 4 && options.length < this.state.studyQueue.length) {
                var randItem = this.state.studyQueue[Math.floor(Math.random() * this.state.studyQueue.length)];
                if (!options.some(opt => (opt.id || opt.word) === (randItem.id || randItem.word))) options.push(randItem);
            }
            options.sort(() => Math.random() - 0.5); 

            options.forEach(opt => {
                var btn = document.createElement('button');
                btn.className = 'option-btn';
                if (aType === 'mc-py') btn.innerText = opt.pinyin; 
                else if (qType === 'en') btn.innerText = opt.word || opt.simplified;
                else btn.innerText = opt.definition || opt.meaning || opt.english;

                btn.onpointerdown = (e) => {
                    e.preventDefault(); e.stopPropagation();
                    Array.from(optionsContainer.children).forEach(child => child.disabled = true);
                    if ((opt.id || opt.word) === (item.id || item.word)) {
                        this.playSound('correct'); btn.style.backgroundColor = '#d4edda'; this.state.score++;
                    } else {
                        this.playSound('wrong'); btn.style.backgroundColor = '#f8d7da';
                    }
                    setTimeout(() => this.nextItem(), 1500); 
                };
                optionsContainer.appendChild(btn);
            });
        }
    }

    togglePinyinHint() {
        const hintEl = document.getElementById('qz-pinyin-hint');
        if (hintEl) hintEl.classList.toggle('hidden');
    }

    // --- THE FIXED COMPLETION SCREEN ---
    showCompletion() {
        // Clears any slideshows safely
        if (this.state.isAutoPlaying) this.toggleAutoPlaySlideshow();
        if (this.state.isSentenceAutoPlaying) this.toggleSentenceSlideshow();

        document.querySelectorAll('.study-view').forEach(v => v.classList.remove('active'));
        const completeView = document.getElementById('view-complete');
        if (completeView) completeView.classList.add('active');
        
        const title = document.getElementById('completion-title');
        const desc = document.getElementById('completion-desc');
        const mode = this.state.currentMode;
        
        let btnContainer = document.getElementById('completion-suggestions');
        if (!btnContainer) {
            btnContainer = document.createElement('div');
            btnContainer.id = 'completion-suggestions';
            btnContainer.style.cssText = 'margin-top: 30px; display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;';
            const msgBox = document.querySelector('.completion-message');
            if (msgBox) msgBox.appendChild(btnContainer);
        }
        btnContainer.innerHTML = ''; 

        if (mode === 'quiz' && title && desc) {
            title.innerText = "🎯 Quiz Complete!";
            desc.innerHTML = `Great effort! Here is your final score:<br><br>
                              <strong style="color: #28a745; font-size: 1.5rem;">✅ Right: ${this.state.score}</strong>`;
        } else if (title && desc) {
            title.innerText = "🏆 Session Complete";
            desc.innerText = "Excellent work. You have reviewed all items in this set.";
        }

        const restartBtn = document.createElement('button');
        restartBtn.className = 'action-btn'; restartBtn.innerHTML = '🔁 Restart Session';
        restartBtn.onclick = () => { this.setMode(mode); };
        btnContainer.appendChild(restartBtn);

        const reviewBtn = document.createElement('button');
        reviewBtn.className = 'action-btn'; reviewBtn.innerHTML = '🎯 Review Unknown Words';
        // Connect directly to the bulletproof review function
        reviewBtn.onclick = () => { this.startReviewMode(); };
        btnContainer.appendChild(reviewBtn);

        this.triggerConfetti();
    }

    saveSession() {
        if (!this.state.studyQueue || this.state.studyQueue.length === 0) return; 
        const sessionData = { queue: this.state.studyQueue, index: this.state.currentIndex, mode: this.state.currentMode, score: this.state.score, history: this.state.history || [] };
        localStorage.setItem('mandarinActiveSession', JSON.stringify(sessionData));
    }

    loadProgress() {
        const saved = localStorage.getItem('aladsProgress');
        let prog = { mastered: [], reviewQueue: [], streak: 0, lastDate: null, dailyMastered: 0 };
        if (saved) { 
            try { 
                let parsed = JSON.parse(saved);
                prog = { ...prog, ...parsed }; 
                // CRITICAL SAFETY FIX: Guarantee array exists
                if (!Array.isArray(prog.reviewQueue)) prog.reviewQueue = [];
            } catch(e) {} 
        }
        return prog;
    }

    saveProgress() {
        localStorage.setItem('aladsProgress', JSON.stringify(this.state.progress));
        this.updateProgressUI();
    }

    updateProgressUI() {
        const r = document.getElementById('review-count');
        if(r) r.innerText = this.state.progress.reviewQueue ? this.state.progress.reviewQueue.length : 0;

        const mCurrent = document.getElementById('mode-current');
        const total = this.state.studyQueue ? this.state.studyQueue.length : 0;
        if (mCurrent) mCurrent.innerText = total === 0 ? 0 : Math.min(this.state.currentIndex + 1, total);
        
        const mTotal = document.getElementById('mode-total');
        if (mTotal) mTotal.innerText = total;

        const knownCountSpan = document.getElementById('stat-known-count');
        const studyCountSpan = document.getElementById('stat-study-count');
        
        if (knownCountSpan && studyCountSpan && this.state.history) {
            let known = 0, studyMore = 0;
            this.state.history.forEach(h => {
                if (h.direction === 'right') known++;
                if (h.direction === 'left') studyMore++;
            });
            knownCountSpan.innerText = known;
            studyCountSpan.innerText = studyMore;
        }
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (this.state.currentMode !== 'flashcards') return;
            const card = document.getElementById('flashcard');
            if (e.code === 'Space') { e.preventDefault(); this.flipCard(); }
            if (e.code === 'ArrowRight') { setTimeout(() => this.handleSwipe('right'), 150); }
            if (e.code === 'ArrowLeft') { setTimeout(() => this.handleSwipe('left'), 150); }
        });

        const card = document.getElementById('flashcard');
        if (!card) return;
        
        let startX = 0, startTime = 0;
        const newCard = card.cloneNode(true);
        card.parentNode.replaceChild(newCard, card);
        const activeCard = document.getElementById('flashcard');

        activeCard.style.touchAction = 'none';

        activeCard.addEventListener('pointerdown', (e) => {
            if(e.target.tagName.toLowerCase() === 'button') return; 
            if (e.pointerType === 'mouse' && e.button !== 0) return; 
            this.swipeState.isDragging = true; startX = e.clientX; startTime = Date.now();
            activeCard.style.transition = 'none'; activeCard.setPointerCapture(e.pointerId); 
        });

        activeCard.addEventListener('touchmove', (e) => { e.preventDefault(); }, { passive: false });
        document.addEventListener('touchmove', (e) => { if (this.swipeState.isDragging) e.preventDefault(); }, { passive: false });
        
        activeCard.addEventListener('pointermove', (e) => {
            if (!this.swipeState.isDragging) return;
            const deltaX = e.clientX - startX;
            activeCard.style.transform = `translateX(${deltaX}px) rotate(${deltaX * 0.05}deg)`;
        });
        
        const endSwipe = (e) => {
            if (!this.swipeState.isDragging) return;
            this.swipeState.isDragging = false;
            try { activeCard.releasePointerCapture(e.pointerId); } catch(err) {}
            
            const deltaX = e.clientX - startX;
            const swipeThreshold = Math.min(80, window.innerWidth * 0.25);
            
            if (Math.abs(deltaX) < 15 && (Date.now() - startTime) < 400) {
                activeCard.style.transition = 'transform 0.3s ease'; 
                activeCard.style.transform = ''; 
                this.flipCard();
            } else if (deltaX > swipeThreshold) { 
                this.handleSwipe('right');
            } else if (deltaX < -swipeThreshold) { 
                this.handleSwipe('left');
            } else { 
                activeCard.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'; 
                activeCard.style.transform = ''; 
            }
        };

        activeCard.addEventListener('pointerup', endSwipe);
        activeCard.addEventListener('pointercancel', endSwipe);
    }

    triggerConfetti() {
        const canvas = document.getElementById('confetti-canvas');
        if (!canvas) return; 
        canvas.style.display = 'block'; 
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth; canvas.height = window.innerHeight;
        let p = Array.from({length:80}, () => ({x:Math.random()*canvas.width, y:-10, w:8, h:8, c:`hsl(${Math.random()*360},70%,50%)`, vy:Math.random()*4+2}));
        const draw = () => {
            ctx.clearRect(0,0,canvas.width,canvas.height);
            p.forEach(f => { ctx.fillStyle=f.c; ctx.fillRect(f.x,f.y,f.w,f.h); f.y+=f.vy; });
            if(p.some(f => f.y < canvas.height)) requestAnimationFrame(draw); else canvas.style.display='none';
        }; 
        draw();
    }
}

let app;
document.addEventListener("DOMContentLoaded", () => { app = new ChineseApp(); });

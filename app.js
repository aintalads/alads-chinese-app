class ChineseApp {
    constructor() {

        window.speechSynthesis.getVoices(); 
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
        }

        // Unlock audio on the very first tap anywhere on the screen
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
        
        // Pre-load voices to fix mobile delays
        window.speechSynthesis.getVoices(); 
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
        }
        
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
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, now); 
            osc.frequency.setValueAtTime(659.25, now + 0.1); 
            gain.gain.setValueAtTime(0.5, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now); osc.stop(now + 0.3);
        } else if (type === 'wrong') { 
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.setValueAtTime(120, now + 0.15);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now); osc.stop(now + 0.3);
        } else if (type === 'swipe-right') { 
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now); osc.stop(now + 0.15);
        } else if (type === 'swipe-left') { 
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(200, now);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now); osc.stop(now + 0.15);
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
        if(bookContainer) bookContainer.innerHTML = '';
        Object.keys(this.data.books).forEach(bId => {
            const chip = document.createElement('div');
            chip.className = `chip ${this.state.selectedBooks.has(bId) ? 'active' : ''}`;
            chip.innerText = `📖 Book ${bId}`;
            chip.onclick = () => {
                if(this.state.selectedBooks.has(bId)) this.state.selectedBooks.delete(bId);
                else this.state.selectedBooks.add(bId);
                this.renderChips();
            };
            if(bookContainer) bookContainer.appendChild(chip);
        });

        let availableLessons = new Set();
        this.state.selectedBooks.forEach(bId => {
            Object.keys(this.data.books[bId].lessons).forEach(lId => availableLessons.add(parseInt(lId)));
        });

        const lessonContainer = document.getElementById('lesson-chips');
        if(lessonContainer) lessonContainer.innerHTML = '';
        
        Array.from(availableLessons).sort((a,b)=>a-b).forEach(lId => {
            const strId = lId.toString();
            const chip = document.createElement('div');
            chip.className = `chip ${this.state.selectedLessons.has(strId) ? 'active' : ''}`;
            chip.innerText = `${lId}`;
            chip.onclick = () => {
                if(this.state.selectedLessons.has(strId)) this.state.selectedLessons.delete(strId);
                else this.state.selectedLessons.add(strId);
                chip.classList.toggle('active');
            };
            if(lessonContainer) lessonContainer.appendChild(chip);
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
    }

    startReviewMode() {
        if (this.state.progress.reviewQueue.length === 0) {
            alert("Your 'Study Again' list is empty. Great job! 🎉");
            return;
        }
        this.state.isReviewMode = true;
        this.state.currentMode = 'flashcards';
        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
        const fb = document.getElementById(`btn-flashcards`);
        if(fb) fb.classList.add('active');
        if(window.innerWidth <= 800) this.toggleSidebar();
        this.loadCurrentMode();
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

            document.getElementById('current-title').innerText = `📚 Study Session`;
            
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
        const listUi = document.getElementById('review-list-ui');
        if(!listUi) return;
        listUi.innerHTML = '';
        if (this.state.progress.reviewQueue.length === 0) {
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
                    <button class="remove-btn" onclick="app.removeFromReviewQueue('${item.id}')">🗑️ Remove</button>
                `;
                listUi.appendChild(li);
            });
        }
    }

    removeFromReviewQueue(id) {
        this.state.progress.reviewQueue = this.state.progress.reviewQueue.filter(i => i && i.id !== id);
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

    renderCurrentItem() {
        if (this.state.studyQueue.length === 0) return this.showEmptyState();
        if (this.state.currentIndex >= this.state.studyQueue.length) return this.showCompletionScreen();

        const mc = document.getElementById('mode-current');
        if(mc) mc.innerText = this.state.currentIndex + 1;
        const mt = document.getElementById('mode-total');
        if(mt) mt.innerText = this.state.studyQueue.length;

        if (this.state.currentMode === 'flashcards') this.renderFlashcard();
        if (this.state.currentMode === 'writing') this.renderWritingChar();
        if (this.state.currentMode === 'sentences') this.renderSentence();
        if (this.state.currentMode === 'quiz') this.renderQuiz();
    }

    nextItem() { this.state.currentIndex++; this.renderCurrentItem(); }
    prevItem() { if(this.state.currentIndex > 0) { this.state.currentIndex--; this.renderCurrentItem(); } }
    shuffleItems() { this.state.studyQueue.sort(() => Math.random() - 0.5); this.state.currentIndex = 0; this.renderCurrentItem(); }

    showEmptyState() {
        document.querySelectorAll('.study-view').forEach(v => v.classList.remove('active'));
        document.getElementById('view-complete').classList.add('active');
        document.getElementById('completion-title').innerText = "Empty Selection";
    }

    showCompletionScreen() {
        if (this.state.isAutoPlaying) this.toggleAutoPlaySlideshow(); 
        if (this.state.isSentenceAutoPlaying) this.toggleSentenceSlideshow();
        document.querySelectorAll('.study-view').forEach(v => v.classList.remove('active'));
        document.getElementById('view-complete').classList.add('active');
        document.getElementById('completion-title').innerText = "Session Complete 🏆";
        this.triggerConfetti();
    }

    toggleAutoAudio() {
        this.state.autoAudio = !this.state.autoAudio;
        const text = this.state.autoAudio ? "🔊 Auto-Audio On" : "🔇 Auto-Audio Off";
        ['fc-auto-audio-btn', 'sn-auto-audio-btn'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) { btn.innerText = text; btn.classList.toggle('active', this.state.autoAudio); }
        });
    }

    /* --- MOBILE AUDIO FIX --- */
    playAudio(text, lang = 'zh-CN', callback = null) {
        if (!text) return;
        window.speechSynthesis.cancel(); 
        
        const msg = new SpeechSynthesisUtterance(text);
        msg.lang = lang; // Defaults to zh-CN which has better mobile support
        msg.rate = 0.85; 

        // Force the browser to find a matching voice (Crucial for mobile phones)
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
            let targetVoice = voices.find(v => v.lang.replace('_', '-').toLowerCase().includes(lang.toLowerCase()));
            if (!targetVoice && lang.includes('zh')) {
                // If specific Chinese dialect fails, grab ANY available Chinese voice
                targetVoice = voices.find(v => v.lang.includes('zh'));
            }
            if (targetVoice) msg.voice = targetVoice;
        }

        msg.onend = () => { if (callback) callback(); };
        window.speechSynthesis.speak(msg);
    }

    renderFlashcard() {
        var item = this.state.studyQueue[this.state.currentIndex];
        if (!item) return; 
        
        document.getElementById('fc-front-text').innerText = item.word || item.simplified || "?";
        document.getElementById('fc-pinyin').innerText = item.pinyin || "";
        document.getElementById('fc-meaning').innerText = item.definition || item.meaning || item.english || "";
        
        let radBox = document.getElementById('fc-radical-box');
        let exBox = document.getElementById('fc-example-box');
        radBox.classList.add('hidden');
        exBox.classList.add('hidden');

        if (window.CHARS_DATA) {
            let firstChar = (item.word || item.simplified || "")[0];
            let charData = window.CHARS_DATA.find(c => c.hanzi === firstChar);
            if (charData && charData.radical) {
                radBox.innerHTML = `<strong>🧩 Radical Info:</strong> The character contains the radical <b>${charData.radical}</b>.`;
                radBox.classList.remove('hidden');
            }
        }

        if (window.sentences) {
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
                this.state.isAnimating = false; 
            }, 10);
        }

        if (this.state.autoAudio && !this.state.isAutoPlaying) this.playAudio(item.word || item.simplified, 'zh-CN');

        var knownCount = 0; var studyCount = 0;
        if (this.state.history) {
            this.state.history.forEach(h => {
                if (h.direction === 'right') knownCount++;
                if (h.direction === 'left') studyCount++;
            });
        }
        document.getElementById('stat-study-count').innerText = studyCount;
        document.getElementById('stat-known-count').innerText = knownCount;
    }

    flipCard() { 
        const card = document.getElementById('flashcard');
        if(card) card.classList.toggle('is-flipped'); 
    }

    handleSwipe(direction) {
        if (this.state.isAnimating) return; 
        this.state.isAnimating = true;
        
        this.playSound(direction === 'right' ? 'swipe-right' : 'swipe-left');

        const item = this.state.studyQueue[this.state.currentIndex];
        if (item) this.state.history.push({ index: this.state.currentIndex, item: item, direction: direction });
        else { this.state.isAnimating = false; this.nextItem(); return; }

        const card = document.getElementById('flashcard');
        const moveX = direction === 'right' ? 350 : -350;
        if(card) {
            card.style.transition = 'transform 0.3s ease, opacity 0.3s ease'; 
            card.style.transform = `translateX(${moveX}px) rotate(${moveX/10}deg)`;
            card.style.opacity = '0';
        }

        setTimeout(() => {
            if (direction === 'right') { 
                if (!this.state.progress.mastered.some(i => i.id === item.id)) {
                    this.state.progress.mastered.push(item);
                    this.state.progress.dailyMastered += 1;
                }
                this.state.progress.reviewQueue = this.state.progress.reviewQueue.filter(i => i.id !== item.id);
            } else { 
                if (!this.state.progress.reviewQueue.some(i => i.id === item.id)) this.state.progress.reviewQueue.push(item);
            }
            this.saveProgress();
            if(card) card.style.transition = 'none';
            this.nextItem();
            this.state.isAnimating = false; 
        }, 250);
    }

    undoLastSwipe() {
        if (!this.state.history || this.state.history.length === 0) return;
        const lastAction = this.state.history.pop();
        this.state.currentIndex = lastAction.index;
        
        if (lastAction.direction === 'right') {
            this.state.progress.mastered = this.state.progress.mastered.filter(i => i.id !== lastAction.item.id);
            this.state.progress.dailyMastered = Math.max(0, this.state.progress.dailyMastered - 1);
        }
        this.saveProgress();
        this.renderCurrentItem();
    }

    toggleAutoPlaySlideshow() {
        this.state.isAutoPlaying = !this.state.isAutoPlaying;
        const btn = document.getElementById('auto-play-btn');
        if(!btn) return;
        if (this.state.isAutoPlaying) {
            btn.innerText = "⏸️ Stop Slideshow";
            btn.classList.add('active');
            this.runSlideshowStep();
        } else {
            btn.innerText = "▶️ Slideshow";
            btn.classList.remove('active');
            clearTimeout(this.slideshowTimeout);
        }
    }

    runSlideshowStep() {
        if (!this.state.isAutoPlaying || this.state.currentIndex >= this.state.studyQueue.length) {
            if (this.state.isAutoPlaying) this.toggleAutoPlaySlideshow();
            return;
        }

        let speedMultiplier = 1;
        const speedVal = document.getElementById('fc-speed-select') ? document.getElementById('fc-speed-select').value : 'normal';
        if (speedVal === 'slow') speedMultiplier = 1.5;
        if (speedVal === 'fast') speedMultiplier = 0.5;

        const item = this.state.studyQueue[this.state.currentIndex];
        this.playAudio(item.word || item.simplified, 'zh-CN');

        this.slideshowTimeout = setTimeout(() => {
            if (!this.state.isAutoPlaying) return;
            this.flipCard();
            const eng = item.definition || item.meaning || item.english;
            this.playAudio(eng, 'en-US');

            this.slideshowTimeout = setTimeout(() => {
                if (!this.state.isAutoPlaying) return;
                this.handleSwipe('right');
                
                this.slideshowTimeout = setTimeout(() => this.runSlideshowStep(), 800 * speedMultiplier);
            }, 2000 * speedMultiplier); 
        }, 1500 * speedMultiplier); 
    }

    renderWritingChar() {
        const char = this.state.studyQueue[this.state.currentIndex];
        const charData = window.CHARS_DATA ? window.CHARS_DATA.find(c => c.hanzi === char) : null;
        document.getElementById('wr-pinyin').innerText = charData ? charData.pinyin : char;
        document.getElementById('wr-meaning').innerText = charData ? charData.meaning : '';

        const targetDiv = document.getElementById('character-target-div');
        if(!targetDiv) return;
        targetDiv.innerHTML = ''; 

        const isDark = document.body.className.includes('dark') || document.body.className.includes('midnight');

        this.hanziWriter = HanziWriter.create('character-target-div', char, {
            width: 250, height: 250, padding: 15, drawingWidth: 55,
            strokeColor: isDark ? '#E8E6E1' : '#000000',
            radicalColor: isDark ? '#5EBBBA' : '#007bff', 
            showOutline: !this.state.outlineHidden,
            outlineColor: isDark ? '#334155' : '#e0e0e0'
        });
        
        document.getElementById('toggle-outline-btn').innerText = this.state.outlineHidden ? "👁️ Show Outline" : "🙈 Hide Outline";
        this.hanziWriter.quiz();
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

        let speedMultiplier = 1;
        const speedVal = document.getElementById('sn-speed-select') ? document.getElementById('sn-speed-select').value : 'normal';
        if (speedVal === 'slow') speedMultiplier = 1.5;
        if (speedVal === 'fast') speedMultiplier = 0.5;

        const s = this.state.studyQueue[this.state.currentIndex];
        this.playAudio(s.sentence, 'zh-CN', () => {
            this.sentenceSlideshowTimeout = setTimeout(() => {
                if (!this.state.isSentenceAutoPlaying) return;
                this.revealSentence(); 
                this.playAudio(s.english, 'en-US', () => {
                    this.sentenceSlideshowTimeout = setTimeout(() => {
                        if (!this.state.isSentenceAutoPlaying) return;
                        this.nextItem(); this.runSentenceSlideshowStep();
                    }, 3000 * speedMultiplier);
                });
            }, 1200 * speedMultiplier);
        });
    }

    renderQuiz() {
        var item = this.state.studyQueue[this.state.currentIndex];
        if (!item) return;

        var qTypeSelect = document.getElementById('qz-q-type');
        var aTypeSelect = document.getElementById('qz-a-type');
        if (qTypeSelect && !qTypeSelect.hasAttribute('data-listening')) {
            qTypeSelect.addEventListener('change', () => this.renderQuiz());
            if(aTypeSelect) aTypeSelect.addEventListener('change', () => this.renderQuiz());
            qTypeSelect.setAttribute('data-listening', 'true');
        }

        var scoreUi = document.getElementById('quiz-score-ui');
        if (scoreUi) scoreUi.innerText = `🏆 Score: ${this.state.score || 0} / ${this.state.studyQueue.length}`;

        var qType = qTypeSelect ? qTypeSelect.value : 'zh';
        var aType = aTypeSelect ? aTypeSelect.value : 'mc';

        var questionText = ""; var correctMeaning = "";
        
        if (qType === 'zh') {
            questionText = item.word || item.simplified; correctMeaning = item.definition || item.meaning || item.english || "";
        } else if (qType === 'py') {
            questionText = item.pinyin; correctMeaning = item.definition || item.meaning || item.english || "";
        } else if (qType === 'en') {
            questionText = item.definition || item.meaning || item.english; correctMeaning = item.pinyin || item.word || item.simplified || "";
        }

        document.getElementById('qz-word').innerText = questionText;
        
        // --- QUIZ AUDIO FIX --- 
        document.getElementById('qz-sound-btn').onclick = () => this.playAudio(item.word || item.simplified, 'zh-CN');
        if (this.state.autoAudio) this.playAudio(item.word || item.simplified, 'zh-CN');

        var optionsContainer = document.getElementById('qz-options');
        optionsContainer.innerHTML = ''; 

        var cleanText = (str) => {
            if (!str) return "";
            return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "").toLowerCase();
        };

        if (aType === 'type') {
            optionsContainer.style.display = 'block';
            var inputField = document.createElement('input');
            inputField.type = 'text'; inputField.className = 'quiz-input';
            inputField.placeholder = `Type the ${qType === 'en' ? 'Pinyin / Chinese' : 'English'}...`;

            var submitBtn = document.createElement('button');
            submitBtn.innerText = 'Submit Answer'; submitBtn.className = 'option-btn'; 
            submitBtn.style.width = '100%'; submitBtn.style.maxWidth = '500px'; submitBtn.style.display = 'block'; submitBtn.style.margin = '0 auto';

            var feedback = document.createElement('div');
            feedback.className = 'quiz-feedback';

            optionsContainer.appendChild(inputField); optionsContainer.appendChild(submitBtn); optionsContainer.appendChild(feedback);
            setTimeout(() => inputField.focus(), 100);

            var checkAnswer = () => {
                var cleanedUserInput = cleanText(inputField.value);
                var correctMeaningsList = correctMeaning.split(/[,/;]/).map(m => cleanText(m));
                var isCorrect = correctMeaningsList.some(m => m === cleanedUserInput || (m.includes(cleanedUserInput) && cleanedUserInput.length > 2));

                if (isCorrect) {
                    this.playSound('correct'); 
                    this.state.score++;
                    feedback.innerHTML = `✅ <b>Correct!</b><br><span style="font-size:0.9rem;">Answer: ${correctMeaning}</span>`;
                    feedback.style.backgroundColor = '#d4edda'; feedback.style.color = '#155724';
                    inputField.style.borderColor = '#28a745';
                } else {
                    this.playSound('wrong'); 
                    feedback.innerHTML = `❌ <b>Incorrect.</b><br>Right answer: <b>${correctMeaning}</b>`;
                    feedback.style.backgroundColor = '#f8d7da'; feedback.style.color = '#721c24';
                    inputField.style.borderColor = '#dc3545';
                }
                document.getElementById('quiz-score-ui').innerText = `🏆 Score: ${this.state.score} / ${this.state.studyQueue.length}`;
                submitBtn.disabled = true; inputField.disabled = true;
                setTimeout(() => this.nextItem(), 1200); 
            };

            submitBtn.onclick = checkAnswer;
            inputField.addEventListener('keypress', (e) => { if (e.key === 'Enter') checkAnswer(); });

        } else {
            optionsContainer.style.display = 'grid'; 
            var options = [item];
            while (options.length < 4 && options.length < this.state.studyQueue.length) {
                var randItem = this.state.studyQueue[Math.floor(Math.random() * this.state.studyQueue.length)];
                if (!options.some(opt => opt.id === randItem.id)) options.push(randItem);
            }
            options.sort(() => Math.random() - 0.5); 

            options.forEach(opt => {
                var btn = document.createElement('button');
                btn.className = 'option-btn';
                if (qType === 'en') btn.innerText = `${opt.word || opt.simplified} (${opt.pinyin})`;
                else btn.innerText = opt.definition || opt.meaning || opt.english;

                btn.onclick = () => {
                    Array.from(optionsContainer.children).forEach(child => child.disabled = true);
                    if (opt.id === item.id) {
                        this.playSound('correct'); 
                        btn.style.backgroundColor = '#d4edda'; btn.style.borderColor = '#28a745'; btn.style.color = '#155724';
                        this.state.score++;
                    } else {
                        this.playSound('wrong'); 
                        btn.style.backgroundColor = '#f8d7da'; btn.style.borderColor = '#dc3545'; btn.style.color = '#721c24';
                        Array.from(optionsContainer.children).forEach(child => {
                            if (child.innerText.includes(item.definition || item.word || item.english)) {
                                child.style.backgroundColor = '#d4edda'; child.style.borderColor = '#28a745';
                            }
                        });
                    }
                    document.getElementById('quiz-score-ui').innerText = `🏆 Score: ${this.state.score} / ${this.state.studyQueue.length}`;
                    setTimeout(() => this.nextItem(), 1000);
                };
                optionsContainer.appendChild(btn);
            });
        }
    }

    loadProgress() {
        const saved = localStorage.getItem('aladsProgress');
        let prog = { mastered: [], reviewQueue: [], streak: 0, lastDate: null, dailyMastered: 0 };
        if (saved) { try { prog = { ...prog, ...JSON.parse(saved) }; } catch(e) {} }
        const today = new Date().toDateString();
        if (prog.lastDate !== today) {
            prog.streak = prog.lastDate === new Date(Date.now() - 86400000).toDateString() ? prog.streak + 1 : (prog.streak?1:0);
            prog.dailyMastered = 0; prog.lastDate = today;
            localStorage.setItem('aladsProgress', JSON.stringify(prog));
        }
        return prog;
    }

    saveProgress() { localStorage.setItem('aladsProgress', JSON.stringify(this.state.progress)); this.updateProgressUI(); }
    updateProgressUI() {
        // --- 1. YOUR EXISTING CODE (Keeps Streak & Sidebar working) ---
        const s = document.getElementById('streak-count');
        if(s) s.innerText = this.state.progress.streak;
        
        const r = document.getElementById('review-count');
        if(r) r.innerText = this.state.progress.reviewQueue.length;
        
        const d = document.getElementById('daily-mastered');
        if(d) d.innerText = this.state.progress.dailyMastered;
        
        const pb = document.getElementById('daily-progress-bar');
        if(pb) pb.style.width = `${Math.min((this.state.progress.dailyMastered / 10) * 100, 100)}%`;

        // --- 2. NEW CODE FOR THE HEADER NUMBERS ---
        const total = this.state.studyQueue ? this.state.studyQueue.length : 0;
        const current = this.state.currentIndex + 1;
        
        // Update the top right progress (e.g., 1 / 10)
        const mCurrent = document.getElementById('mode-current');
        if (mCurrent) mCurrent.innerText = total === 0 ? 0 : Math.min(current, total);
        
        const mTotal = document.getElementById('mode-total');
        if (mTotal) mTotal.innerText = total;

        // Update the Known / Study More numbers
        const knownCountSpan = document.getElementById('stat-known-count');
        const studyCountSpan = document.getElementById('stat-study-count');
        
        if (knownCountSpan && studyCountSpan && this.state.studyQueue) {
            let known = 0;
            let unknown = 0;
            
            // Count how many words are known vs unknown in the current session
            this.state.studyQueue.forEach(word => {
                if (this.state.progress.knownWords && this.state.progress.knownWords.includes(word)) {
                    known++;
                } else {
                    unknown++;
                }
            });
            
            knownCountSpan.innerText = known;
            studyCountSpan.innerText = unknown;
        }
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (this.state.currentMode !== 'flashcards') return;
            const card = document.getElementById('flashcard');
            if (e.code === 'Space') { e.preventDefault(); this.flipCard(); }
            if (e.code === 'ArrowRight') {
                if (card) card.style.boxShadow = '0 0 40px rgba(0, 255, 0, 1)';
                setTimeout(() => this.handleSwipe('right'), 150); 
            }
            if (e.code === 'ArrowLeft') {
                if (card) card.style.boxShadow = '0 0 40px rgba(255, 0, 0, 1)';
                setTimeout(() => this.handleSwipe('left'), 150);
            }
        });

        const card = document.getElementById('flashcard');
        if (!card) return;
        
        let startX = 0, startTime = 0;
        const newCard = card.cloneNode(true);
        card.parentNode.replaceChild(newCard, card);
        const activeCard = document.getElementById('flashcard');

        // --- MOBILE TOUCH FIX ---
        activeCard.style.touchAction = 'none';

        activeCard.addEventListener('pointerdown', (e) => {
            if(e.target.tagName.toLowerCase() === 'button') return; 
            // Ignore right-clicks to prevent bugs on desktop
            if (e.pointerType === 'mouse' && e.button !== 0) return; 

            this.swipeState.isDragging = true;
            startX = e.clientX; 
            startTime = Date.now();
            activeCard.style.transition = 'none';
            activeCard.setPointerCapture(e.pointerId); 
        });
        
        activeCard.addEventListener('pointermove', (e) => {
            if (!this.swipeState.isDragging) return;
            const deltaX = e.clientX - startX;
            activeCard.style.transform = `translateX(${deltaX}px) rotate(${deltaX * 0.05}deg)`;
            
            // Keep your awesome box shadow effects!
            if (deltaX > 20) activeCard.style.boxShadow = `0 0 40px rgba(0, 255, 0, ${Math.min(deltaX/100, 0.8)})`;
            else if (deltaX < -20) activeCard.style.boxShadow = `0 0 40px rgba(255, 0, 0, ${Math.min(Math.abs(deltaX)/100, 0.8)})`;
            else activeCard.style.boxShadow = 'none';
        });
        
        // --- THE FIX: Create a reusable endSwipe function ---
        const endSwipe = (e) => {
            if (!this.swipeState.isDragging) return;
            this.swipeState.isDragging = false;
            activeCard.releasePointerCapture(e.pointerId);
            const deltaX = e.clientX - startX;
            
            // Instantly clear the glowing shadow
            activeCard.style.boxShadow = 'none'; 
            
            if (Math.abs(deltaX) < 15 && (Date.now() - startTime) < 400) {
                // It was a quick tap, so flip the card
                activeCard.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease'; 
                activeCard.style.transform = 'translateX(0) rotate(0)';
                this.flipCard();
            } 
            else if (deltaX > 80) { // Changed to 80 so it's slightly easier to swipe on phones!
                this.handleSwipe('right');
            } 
            else if (deltaX < -80) { 
                this.handleSwipe('left');
            } 
            else { 
                // Cancelled swipe (didn't drag far enough or finger slipped): Snap back to center
                activeCard.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease'; 
                activeCard.style.transform = 'translateX(0) rotate(0)'; 
            }
        };

        // --- Attach to BOTH pointerup AND pointercancel so it never gets stuck ---
        activeCard.addEventListener('pointerup', endSwipe);
        activeCard.addEventListener('pointercancel', endSwipe);
    }
// ==========================================
    // --- SPEECH SYNTHESIS ENGINE ---
    // ==========================================

    playAudio(text, speedPref = 'normal') {
        if (!text || !window.speechSynthesis) return;

        // 1. Instantly cancel any audio that is currently playing so they don't overlap
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        // 2. Set the Speed based on the dropdown menu
        let rate = 1.0;
        if (speedPref === 'slow') rate = 0.5; // Slower for clear pronunciation
        if (speedPref === 'fast') rate = 1.3;
        utterance.rate = rate;

        // 3. Find the best Mandarin voice
        const voices = window.speechSynthesis.getVoices();
        
        // Prioritize a natural-sounding Taiwanese/Traditional Mandarin voice 
        let zhVoice = voices.find(v => v.lang === 'zh-TW' || v.lang === 'zh_TW');
        
        // Fallback to any available Chinese voice if that exact one isn't found
        if (!zhVoice) {
            zhVoice = voices.find(v => v.lang.includes('zh'));
        }

        if (zhVoice) {
            utterance.voice = zhVoice;
        } else {
            utterance.lang = 'zh-TW'; // Ultimate fallback to let the browser figure it out
        }

        // 4. Speak!
        window.speechSynthesis.speak(utterance);
    }

    // --- Wrapper for the Flashcard Speaker Button ---
    playCurrentFlashcardAudio(event) {
        if (event) event.stopPropagation(); // Stops the card from flipping when you click the speaker
        
        const text = document.getElementById('fc-front-text').innerText;
        const speed = document.getElementById('fc-speed-select').value;
        
        this.playAudio(text, speed);
    }

    // --- Wrapper for the Sentence Speaker Button ---
    playSentenceAudio() {
        const text = document.getElementById('sn-chinese').innerText;
        const speed = document.getElementById('sn-speed-select').value;
        
        this.playAudio(text, speed);
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

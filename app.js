class ChineseApp {
    constructor() {

        // Inside constructor()
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
        
        // 🚨 THE FIX: Dynamically find the actual first book and lesson
        const firstBook = Object.keys(this.data.books)[0];
        if (firstBook) {
            this.state.selectedBooks.add(firstBook);
            
            // Look at the data and grab the actual first lesson (whether it is 0, 1, or Intro)
            const firstLesson = Object.keys(this.data.books[firstBook].lessons)[0];
            if (firstLesson) {
                this.state.selectedLessons.add(firstLesson.toString()); 
            }
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
        if (bookContainer) bookContainer.innerHTML = '';
        
        // --- 1. RENDER BOOK CHIPS ---
        Object.keys(this.data.books).forEach(bId => {
            const chip = document.createElement('div');
            chip.className = `chip ${this.state.selectedBooks.has(bId) ? 'active' : ''}`;
            chip.innerText = `📖 Book ${bId}`;
            
            chip.onclick = () => {
                // Update selection state
                if (this.state.selectedBooks.has(bId)) {
                    this.state.selectedBooks.delete(bId);
                } else {
                    this.state.selectedBooks.add(bId);
                }
                
                // MOBILE FIX: Load content first, then refresh the UI colors
                this.applyCourseSelection(); 
                this.renderChips();
            };
            if (bookContainer) bookContainer.appendChild(chip);
        });

        // Calculate which lessons are available based on selected books
        let availableLessons = new Set();
        this.state.selectedBooks.forEach(bId => {
            if (this.data.books[bId] && this.data.books[bId].lessons) {
                Object.keys(this.data.books[bId].lessons).forEach(lId => availableLessons.add(parseInt(lId)));
            }
        });

        const lessonContainer = document.getElementById('lesson-chips');
        if (lessonContainer) lessonContainer.innerHTML = '';
        
        // --- 2. RENDER LESSON CHIPS ---
        Array.from(availableLessons).sort((a, b) => a - b).forEach(lId => {
            const strId = lId.toString();
            const chip = document.createElement('div');
            chip.className = `chip ${this.state.selectedLessons.has(strId) ? 'active' : ''}`;
            chip.innerText = `${lId}`;
            
            chip.onclick = () => {
                // Update selection state
                if (this.state.selectedLessons.has(strId)) {
                    this.state.selectedLessons.delete(strId);
                } else {
                    this.state.selectedLessons.add(strId);
                }
                
                // MOBILE FIX: Load content first, then refresh the UI colors
                this.applyCourseSelection();
                this.renderChips();
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
    }

     startReviewMode() {
        // 1. Refresh memory from the global save file
        this.state.progress = this.loadProgress();

        // 2. Check if the bucket is empty
        if (!this.state.progress.reviewQueue || this.state.progress.reviewQueue.length === 0) {
            alert("Your review list is empty! Swipe left on some cards first.");
            return;
        }

        // 3. Set the mode to flashcards safely
        this.state.currentMode = 'flashcards';
        this.state.isReviewMode = true; 

        // 4. Update Sidebar UI
        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById('btn-flashcards');
        if (activeBtn) activeBtn.classList.add('active');

        // 5. Load the mode
        this.loadCurrentMode();
        
        // Hide the Book/Lesson selectors so you focus on review
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

        // Add swipe/touch navigation for flashcards/review mode
        if (this.state.currentMode === 'flashcards' && this.state.isReviewMode) {
            const flashcardView = document.getElementById('view-flashcards');
            if (flashcardView) {
                // Remove previous listeners if any
                flashcardView.ontouchstart = null;
                flashcardView.ontouchend = null;
                let startX = 0;
                let endX = 0;
                    const app = this;
                    flashcardView.ontouchstart = (e) => {
                        if (e.touches && e.touches.length === 1) {
                            startX = e.touches[0].clientX;
                        }
                    };
                    flashcardView.ontouchend = (e) => {
                        if (e.changedTouches && e.changedTouches.length === 1) {
                            endX = e.changedTouches[0].clientX;
                            const diff = endX - startX;
                            if (Math.abs(diff) > 50) {
                                if (diff < 0) {
                                    // Swipe left: add to review
                                    app.handleSwipe('left');
                                } else {
                                    // Swipe right: remove from review
                                    app.handleSwipe('right');
                                }
                            }
                        }
                    };
            }
        }
    }

    renderManageReview() {
        let listUi = document.getElementById('review-list-ui');
        if(!listUi) {
            // Try to create the element if missing (mobile fix)
            const parent = document.getElementById('view-manage-review') || document.body;
            listUi = document.createElement('ul');
            listUi.id = 'review-list-ui';
            parent.appendChild(listUi);
        }
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
                    <button class="remove-btn">🗑️ Remove</button>
                `;
                // Add both click and touch event listeners for remove button
                const btn = li.querySelector('.remove-btn');
                if (btn) {
                    btn.addEventListener('click', () => this.removeFromReviewQueue(item.id));
                    btn.addEventListener('touchstart', (e) => { e.preventDefault(); this.removeFromReviewQueue(item.id); });
                }
                listUi.appendChild(li);
            });
        }
        // Ensure list is visible on mobile
        listUi.style.display = 'block';
        listUi.style.visibility = 'visible';
        listUi.style.maxHeight = '100vh';
        listUi.style.overflowY = 'auto';
        listUi.style.webkitOverflowScrolling = 'touch';
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

    showCompletion() {


        // --- 🔄 RESUME INTERRUPTED SESSION ---
        const activeSession = localStorage.getItem('mandarinActiveSession');
        if (activeSession) {
            // Wait 0.5 seconds for the app to finish loading visually
            setTimeout(() => {
                if(confirm("Welcome back! 🚀 You have an unfinished study session. Would you like to resume exactly where you left off?")) {
                    const parsed = JSON.parse(activeSession);
                    this.state.studyQueue = parsed.queue;
                    this.state.currentIndex = parsed.index;
                    this.state.currentMode = parsed.mode;
                    this.state.score = parsed.score;
                    this.state.history = parsed.history;
                    
                    // Jump right back into the action!
                    this.setMode(this.state.currentMode);
                } else {
                    // They chose not to resume, so delete the saved session
                    localStorage.removeItem('mandarinActiveSession');
                }
            }, 500);
        }
        // 1. Hide all current screens
        document.querySelectorAll('.study-view').forEach(v => v.classList.remove('active'));
        
        // 2. Find the Complete View (or build it if it's missing!)
        let completeView = document.getElementById('view-complete');
        if (!completeView) {
            completeView = document.createElement('div');
            completeView.id = 'view-complete';
            completeView.className = 'study-view active';
            document.querySelector('.main-content') ? document.querySelector('.main-content').appendChild(completeView) : document.body.appendChild(completeView);
        } else {
            completeView.classList.add('active');
        }

        // 3. Find the Message Box (or build it if it's missing!)
        let msgContainer = completeView.querySelector('.completion-message');
        if (!msgContainer) {
            msgContainer = document.createElement('div');
            msgContainer.className = 'completion-message';
            msgContainer.style.textAlign = 'center';
            msgContainer.style.padding = '40px 20px';
            completeView.appendChild(msgContainer);
        }

        // 4. Calculate Math
        const total = this.state.studyQueue.length;
        const right = this.state.score || 0;
        const wrong = total - right;
        const mode = this.state.currentMode;

        // 5. Build the UI
        let contentHTML = `<h1 style="font-size: 2.5rem; margin-bottom: 10px;">
            ${mode === 'quiz' ? '🎯 Quiz Complete!' : '🏆TOCL PASSED!!'}
        </h1>`;

        if (mode === 'quiz') {
            contentHTML += `
                <p style="font-size: 1.2rem; color: var(--text-muted); margin-bottom: 20px;">Here is your final score:</p>
                <div style="background: var(--bg-color); padding: 20px; border-radius: 16px; display: inline-block; margin-bottom: 30px;">
                    <strong style="color: #28a745; font-size: 1.8rem; margin-right: 20px;">✅ ${right} Right</strong>
                    <strong style="color: #dc3545; font-size: 1.8rem;">❌ ${wrong} Wrong</strong>
                </div>
            `;
        } else {
            contentHTML += `<p style="font-size: 1.2rem; color: var(--text-muted); margin-bottom: 30px;">Excellent work. You have reviewed all items in this set.</p>`;
        }

        // 6. Build the Buttons
        contentHTML += `
            <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                <button class="action-btn" onclick="app.state.currentIndex = 0; app.state.score = 0; app.setMode('${mode}')">
                    🔁 Restart This Session
                </button>
                
                <button class="action-btn" id="direct-review-btn" style="background-color: var(--primary-color); color: white;">
                    🎯 Start Reviewing Unknown Words
                </button>
                
                ${mode !== 'flashcards' ? `<button class="action-btn" onclick="app.setMode('flashcards')">🗂️ Study Flashcards</button>` : ''}
            </div>
        `;

        msgContainer.innerHTML = contentHTML;

        // 7. Attach the Review Logic
        document.getElementById('direct-review-btn').onclick = () => {
           this.startReviewMode();;
            if (reviewList.length === 0) {
                alert("Awesome job! 🎉 You don't have any unknown words to review right now.");
                return;
            }
            this.state.studyQueue = [...reviewList];
            this.state.currentIndex = 0;
            this.state.score = 0;
            this.setMode('flashcards'); 
        };

        if (typeof this.triggerConfetti === 'function') this.triggerConfetti();
    }

    nextItem() {
        this.saveSession();
        this.state.currentIndex++;
        
        // If we reached the end of the study queue, show the epic completion screen!
        if (this.state.currentIndex >= this.state.studyQueue.length) {
            this.showCompletion(); 
            return;
        }
        
        // Otherwise, keep rendering the next item...
        if (this.state.currentMode === 'flashcards') this.renderFlashcard();
        else if (this.state.currentMode === 'writing') this.renderWriting();
        else if (this.state.currentMode === 'sentences') this.renderSentence();
        else if (this.state.currentMode === 'quiz') this.renderQuiz();
    }
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

    // --- TOGGLE PINYIN HINT IN QUIZ ---
    togglePinyinHint() {
        const hintEl = document.getElementById('qz-pinyin-hint');
        if (hintEl.classList.contains('hidden')) {
            hintEl.classList.remove('hidden');
        } else {
            hintEl.classList.add('hidden');
        }
    }

    /* --- MOBILE AUDIO FIX --- */
    playAudio(text, speedPref = 'normal') {
    if (!text || !window.speechSynthesis) return;

    // 1. Force stop any current speech
    window.speechSynthesis.cancel();

    // 2. Tiny delay helps Android and iOS hardware reset properly
    setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(text);

        // 3. Set Rate based on your dropdown
        let rate = 0.9; 
        if (speedPref === 'slow') rate = 0.5; 
        if (speedPref === 'fast') rate = 1.2;
        utterance.rate = rate;

        // 4. THE UNIVERSAL VOICE HUNTER
        const voices = window.speechSynthesis.getVoices();
        
        // This looks for the best voice in this order:
        // 1. Apple Premium (iPhone) 
        // 2. Google Native (Android/Chrome)
        // 3. Microsoft Natural (Windows Laptop)
        let bestVoice = voices.find(v => 
            (v.lang.includes('zh-TW') || v.lang.includes('zh-HK')) && 
            (v.name.includes('Premium') || v.name.includes('Google') || v.name.includes('Siri'))
        );

        // Fallback: Any Traditional Chinese voice if premium isn't found
        if (!bestVoice) {
            bestVoice = voices.find(v => v.lang === 'zh-TW' || v.lang === 'zh-HK' || v.lang.includes('zh-Hant'));
        }

        if (bestVoice) {
            utterance.voice = bestVoice;
        } else {
            utterance.lang = 'zh-TW'; // Basic fallback
        }

        window.speechSynthesis.speak(utterance);
    }, 50);
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

    updateProgressUI() {
        // --- 1. HEADER NUMBERS (e.g. 1 / 20) ---
        const total = this.state.studyQueue ? this.state.studyQueue.length : 0;
        const current = this.state.currentIndex + 1;
        
        const mCurrent = document.getElementById('mode-current');
        if (mCurrent) mCurrent.innerText = total === 0 ? 0 : Math.min(current, total);
        
        const mTotal = document.getElementById('mode-total');
        if (mTotal) mTotal.innerText = total;

        // --- 2. SESSION KNOWN / STUDY AGAIN COUNTS ---
        const knownCountSpan = document.getElementById('stat-known-count');
        const studyCountSpan = document.getElementById('stat-study-count');
        
        if (knownCountSpan && studyCountSpan && this.state.history) {
            let known = 0;
            let studyMore = 0;
            
            // Calculate based strictly on the history we just fixed
            this.state.history.forEach(h => {
                if (h.direction === 'right') known++;
                if (h.direction === 'left') studyMore++;
            });
            
            knownCountSpan.innerText = known;
            studyCountSpan.innerText = studyMore;
        }
    }

    handleSwipe(direction) {
        const activeCard = document.getElementById('flashcard');
        const currentItem = this.state.studyQueue[this.state.currentIndex];
        
        // If there's no card on screen, do nothing
        if (!currentItem) return;

        // Unique key for item to prevent duplicates
        const getItemKey = item => item.id || item.word || item.simplified || JSON.stringify(item);
        const currentKey = getItemKey(currentItem);

        // 🛡️ SAFETY NET: Force the review bucket to exist so the app never crashes
        if (!this.state.progress.reviewQueue) {
            this.state.progress.reviewQueue = [];
        }

        // 1. Log the swipe in the history so the numbers count!
        if (!this.state.history) this.state.history = [];
        this.state.history.push({ direction: direction, item: currentItem, index: this.state.currentIndex });

        // 2. Add or Remove from the Review List
        if (direction === 'left') {
            // Check if it's already in the bucket. If not, add it!
            if (!this.state.progress.reviewQueue.some(item => getItemKey(item) === currentKey)) {
                this.state.progress.reviewQueue.push(currentItem);
            }
        } else if (direction === 'right') {
            // Remove it from the bucket if they swipe right
            this.state.progress.reviewQueue = this.state.progress.reviewQueue.filter(item => getItemKey(item) !== currentKey);
        }
        
        // 3. Save to browser memory immediately
        this.saveProgress();
        this.saveSession();

        // 4. Animate the card off-screen and go to the next one
        if (activeCard) {
            activeCard.style.transition = 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.4s ease';
            activeCard.style.opacity = '0';
            activeCard.style.transform = `translateX(${direction === 'left' ? '-150%' : '150%'}) rotate(${direction === 'left' ? '-20deg' : '20deg'})`;

            setTimeout(() => {
                this.nextItem();
                this.updateProgressUI(); 
            }, 300);
        } else {
            // Fallback if the card HTML is missing
            this.nextItem();
            this.updateProgressUI();
        }
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

    togglePinyinHint() {
        const hintEl = document.getElementById('qz-pinyin-hint');
        if (hintEl) {
            if (hintEl.classList.contains('hidden')) {
                hintEl.classList.remove('hidden');
            } else {
                hintEl.classList.add('hidden');
            }
        }
    }

    // --- 💾 AUTO-SAVE FEATURE ---
    saveSession() {
        // Don't save if there is nothing to study
        if (!this.state.studyQueue || this.state.studyQueue.length === 0) return; 
        
        const sessionData = {
            queue: this.state.studyQueue,
            index: this.state.currentIndex,
            mode: this.state.currentMode,
            score: this.state.score,
            history: this.state.history || []
        };
        
        // Save to the phone's hard drive!
        localStorage.setItem('mandarinActiveSession', JSON.stringify(sessionData));
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

        var questionText = ""; 
        var correctMeaning = "";
        
        // --- 1. SET QUESTION & CORRECT ANSWER ---
        if (qType === 'zh') {
            questionText = item.word || item.simplified; 
            // If Answer Mode is Pinyin, we look for item.pinyin
            correctMeaning = (aType === 'mc-py') ? item.pinyin : (item.definition || item.meaning || item.english || "");
        } else if (qType === 'py') {
            questionText = item.pinyin; 
            correctMeaning = item.definition || item.meaning || item.english || "";
        } else if (qType === 'en') {
            questionText = item.definition || item.meaning || item.english; 
            correctMeaning = item.pinyin || item.word || item.simplified || "";
        }

        document.getElementById('qz-word').innerText = questionText;
        
        // --- 2. HINT & AUDIO LOGIC ---
        var pinyinBtn = document.getElementById('qz-pinyin-btn');
        var hintEl = document.getElementById('qz-pinyin-hint');
        if (hintEl) {
            hintEl.classList.add('hidden');
            hintEl.innerText = item.pinyin || ""; 
            if (qType === 'zh') {
                if (pinyinBtn) pinyinBtn.style.display = 'inline-block';
            } else {
                if (pinyinBtn) pinyinBtn.style.display = 'none';
            }
        }

        document.getElementById('qz-sound-btn').onclick = (e) => {
            e.stopPropagation(); 
            this.playAudio(item.word || item.simplified, 'zh-CN');
        };

        if (this.state.autoAudio) this.playAudio(item.word || item.simplified, 'zh-CN');

        var optionsContainer = document.getElementById('qz-options');
        optionsContainer.innerHTML = ''; 

        // --- 3. TYPING MODE ---
        if (aType === 'type') {
            optionsContainer.style.display = 'block';
            var inputField = document.createElement('input');
            inputField.type = 'text'; 
            inputField.className = 'quiz-input';
            inputField.placeholder = `Type here...`;

            var submitBtn = document.createElement('button');
            submitBtn.innerText = 'Submit Answer'; 
            submitBtn.className = 'option-btn'; 
            submitBtn.style.width = '100%'; 

            var feedback = document.createElement('div');
            feedback.className = 'quiz-feedback';

            optionsContainer.appendChild(inputField); 
            optionsContainer.appendChild(submitBtn); 
            optionsContainer.appendChild(feedback);
            setTimeout(() => inputField.focus(), 100);

            var checkTypedAnswer = (e) => {
                if (e) e.stopPropagation();
                var cleanText = (str) => !str ? "" : str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "").toLowerCase();
                var cleanedUserInput = cleanText(inputField.value);
                var correctMeaningsList = correctMeaning.split(/[,/;]/).map(m => cleanText(m));
                var isCorrect = correctMeaningsList.some(m => m === cleanedUserInput || (m.length > 2 && m.includes(cleanedUserInput)));

                if (isCorrect) {
                    this.playSound('correct'); 
                    this.state.score++;
                    feedback.innerHTML = `✅ <b>Correct!</b><br>${correctMeaning}`;
                    feedback.style.backgroundColor = '#d4edda';
                    inputField.style.borderColor = '#28a745';
                } else {
                    this.playSound('wrong'); 
                    feedback.innerHTML = `❌ <b>Incorrect.</b><br>Answer: <b>${correctMeaning}</b>`;
                    feedback.style.backgroundColor = '#f8d7da';
                    inputField.style.borderColor = '#dc3545';
                    if (hintEl && qType === 'zh') hintEl.classList.remove('hidden');
                }
                submitBtn.disabled = true; inputField.disabled = true;
                setTimeout(() => this.nextItem(), 1200); 
            };

            submitBtn.onpointerdown = checkTypedAnswer;
            inputField.addEventListener('keypress', (e) => { if (e.key === 'Enter') checkTypedAnswer(e); });

        // --- 4. MULTIPLE CHOICE MODE (MC-PY, MC, etc) ---
        } else {
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
                
                // Show text based on mode
                if (aType === 'mc-py') btn.innerText = opt.pinyin; 
                else if (qType === 'en') btn.innerText = opt.word || opt.simplified;
                else btn.innerText = opt.definition || opt.meaning || opt.english;

                // Robust ID for comparison
                const currentOptId = String(opt.id || opt.word || opt.simplified);
                btn.dataset.id = currentOptId;

                btn.onpointerdown = (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    Array.from(optionsContainer.children).forEach(child => child.disabled = true);
                    
                    const targetId = String(item.id || item.word || item.simplified);

                    if (currentOptId === targetId) {
                        this.playSound('correct'); 
                        btn.style.backgroundColor = '#d4edda'; 
                        btn.style.borderColor = '#28a745'; 
                        btn.style.color = '#155724';
                        this.state.score++;
                    } else {
                        this.playSound('wrong'); 
                        btn.style.backgroundColor = '#f8d7da'; 
                        btn.style.borderColor = '#dc3545'; 
                        btn.style.color = '#721c24';
                        
                        // Highlight correct button
                        Array.from(optionsContainer.children).forEach(child => {
                            if (child.dataset.id === targetId) {
                                child.style.backgroundColor = '#d4edda'; 
                                child.style.borderColor = '#28a745';
                            }
                        });
                        if (hintEl && qType === 'zh') hintEl.classList.remove('hidden');
                    }
                    
                    if (scoreUi) scoreUi.innerText = `🏆 Score: ${this.state.score} / ${this.state.studyQueue.length}`;
                    setTimeout(() => this.nextItem(), 1500); 
                };
                optionsContainer.appendChild(btn);
            });
        }
    }

        // --- 3. DYNAMIC COMPLETION SCREEN & SUGGESTIONS ---
    showCompletion() {
        // Hide all views and show the complete view
        document.querySelectorAll('.study-view').forEach(v => v.classList.remove('active'));
        document.getElementById('view-complete').classList.add('active');
        
        const title = document.getElementById('completion-title');
        const desc = document.getElementById('completion-desc');
        const mode = this.state.currentMode;
        
        // Clean up old buttons
        let btnContainer = document.getElementById('completion-suggestions');
        if (!btnContainer) {
            btnContainer = document.createElement('div');
            btnContainer.id = 'completion-suggestions';
            btnContainer.style.cssText = 'margin-top: 30px; display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;';
            document.querySelector('.completion-message').appendChild(btnContainer);
        }
        btnContainer.innerHTML = ''; 

        // Score Reveal Logic for Quiz Mode
        if (mode === 'quiz') {
            const total = this.state.studyQueue.length;
            const right = this.state.score || 0;
            const wrong = total - right;
            title.innerText = "🎯 Quiz Complete!";
            desc.innerHTML = `Great effort! Here is your final score:<br><br>
                              <strong style="color: #28a745; font-size: 1.5rem;">✅ Right: ${right}</strong> &nbsp;|&nbsp; 
                              <strong style="color: #dc3545; font-size: 1.5rem;">❌ Wrong: ${wrong}</strong>`;
        } else {
            title.innerText = "🏆 Session Complete";
            desc.innerText = "Excellent work. You have reviewed all items in this set.";
        }

        // --- ADD SUGGESTION BUTTONS ---
        
        // Button 1: Restart Current Session
        const restartBtn = document.createElement('button');
        restartBtn.className = 'action-btn';
        restartBtn.innerHTML = '🔁 Restart Session';
        restartBtn.onclick = () => {
            this.state.currentIndex = 0;
            this.state.score = 0;
            this.setMode(mode); // Reloads the current mode
        };
        btnContainer.appendChild(restartBtn);

        // Button 2: Go to Manage Review (Unknown Words)
        const reviewBtn = document.createElement('button');
        reviewBtn.className = 'action-btn';
        reviewBtn.innerHTML = '⚙️ Manage "Study Again" List';
        reviewBtn.onclick = () => { this.setMode('manage-review'); };
        btnContainer.appendChild(reviewBtn);

        // Button 3: Switch to Flashcards (if not already there)
        if (mode !== 'flashcards') {
            const fcBtn = document.createElement('button');
            fcBtn.className = 'action-btn';
            fcBtn.innerHTML = '🗂️ Study Flashcards';
            fcBtn.onclick = () => { this.setMode('flashcards'); };
            btnContainer.appendChild(fcBtn);
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

    saveProgress() {
        console.log('[saveProgress] Saving progress:', this.state.progress);
        localStorage.setItem('aladsProgress', JSON.stringify(this.state.progress));
        this.updateProgressUI();
    }
    updateProgressUI() {
        // --- 1. SIDEBAR STATS (Streak, Review, Mastered) ---
        const s = document.getElementById('streak-count');
        if(s) s.innerText = this.state.progress.streak || 0;
        
        const r = document.getElementById('review-count');
        if(r) r.innerText = this.state.progress.reviewQueue ? this.state.progress.reviewQueue.length : 0;
        
        const d = document.getElementById('daily-mastered');
        if(d) d.innerText = this.state.progress.dailyMastered || 0;
        
        const pb = document.getElementById('daily-progress-bar');
        if(pb) pb.style.width = `${Math.min(((this.state.progress.dailyMastered || 0) / 10) * 100, 100)}%`;

        // --- 2. HEADER NUMBERS (e.g. 1 / 20) ---
        const total = this.state.studyQueue ? this.state.studyQueue.length : 0;
        const current = this.state.currentIndex + 1;
        
        const mCurrent = document.getElementById('mode-current');
        if (mCurrent) mCurrent.innerText = total === 0 ? 0 : Math.min(current, total);
        
        const mTotal = document.getElementById('mode-total');
        if (mTotal) mTotal.innerText = total;

        // --- 3. SESSION KNOWN / STUDY AGAIN COUNTS ---
        const knownCountSpan = document.getElementById('stat-known-count');
        const studyCountSpan = document.getElementById('stat-study-count');
        
        if (knownCountSpan && studyCountSpan && this.state.history) {
            let known = 0;
            let studyMore = 0;
            
            // Calculate based strictly on your swipes in the current session
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

        // --- ✨ THE MAGIC IPHONE FREEZE FIX ✨ ---
        // This completely stops the iPhone screen from scrolling or bugging out while dragging
        activeCard.addEventListener('touchmove', (e) => {
            e.preventDefault(); 
        }, { passive: false });

        activeCard.addEventListener('pointercancel', (e) => {
            if (!this.swipeState.isDragging) return;
            this.swipeState.isDragging = false;
            
            // Release the pointer
            try { activeCard.releasePointerCapture(e.pointerId); } catch(err) {}
            
            // Instantly snap the card back to the center
            activeCard.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s ease'; 
            activeCard.style.transform = ''; 
            activeCard.style.boxShadow = 'none';
        });

        // Lock the entire screen from scrolling while dragging
        document.addEventListener('touchmove', (e) => {
            if (this.swipeState.isDragging) {
                e.preventDefault();
            }
        }, { passive: false });
        
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
            
            // Safely release the pointer
            try { activeCard.releasePointerCapture(e.pointerId); } catch(err) {}
            
            const deltaX = e.clientX - startX;
            
            // Calculate a smart threshold (80 pixels OR 25% of the screen, whichever is smaller)
            const swipeThreshold = Math.min(80, window.innerWidth * 0.25);
            
            // Instantly clear the glowing shadow
            activeCard.style.boxShadow = 'none'; 
            
            if (Math.abs(deltaX) < 15 && (Date.now() - startTime) < 400) {
                // It was a quick tap, so flip the card
                activeCard.style.transition = 'transform 0.3s ease'; 
                activeCard.style.transform = ''; // Bulletproof reset
                this.flipCard();
            } 
            else if (deltaX > swipeThreshold) { 
                // Swiped right (Got it)
                if (navigator.vibrate) navigator.vibrate(50); 
                this.handleSwipe('right');
            } 
            else if (deltaX < -swipeThreshold) { 
                // Swiped left (Study again)
                if (navigator.vibrate) navigator.vibrate([50, 50, 50]); 
                this.handleSwipe('left');
            } 
            else { 
                // Didn't swipe far enough: Snap back to center!
                // Added a "spring" cubic-bezier curve so it bounces back naturally
                activeCard.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s ease'; 
                activeCard.style.transform = ''; // Completely deletes the dragging offset
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
        if (event) event.stopPropagation();
        
        // Ensure we grab the text from the FRONT of the card
        const text = document.getElementById('fc-front-text').innerText;
        const speed = document.getElementById('fc-speed-select') ? document.getElementById('fc-speed-select').value : 'normal';
        
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

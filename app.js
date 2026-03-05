class ChineseApp {
    constructor() {
        this.data = { books: {} };
        this.state = {
            selectedBooks: new Set(),
            selectedLessons: new Set(),
            currentMode: 'flashcards', 
            isReviewMode: false,
            studyQueue: [], currentIndex: 0, score: 0,
            progress: this.loadProgress()
        };
        this.swipeState = { isDragging: false, startX: 0, currentX: 0 };
        this.hanziWriter = null;
        this.init();
    }

    init() {
        this.processData();
        this.setupEventListeners();
        this.applyDarkMode();
        
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

    renderChips() {
        const bookContainer = document.getElementById('book-chips');
        bookContainer.innerHTML = '';
        Object.keys(this.data.books).forEach(bId => {
            const chip = document.createElement('div');
            chip.className = `chip ${this.state.selectedBooks.has(bId) ? 'active' : ''}`;
            chip.innerText = `Book ${bId}`;
            chip.onclick = () => {
                if(this.state.selectedBooks.has(bId)) this.state.selectedBooks.delete(bId);
                else this.state.selectedBooks.add(bId);
                this.renderChips();
            };
            bookContainer.appendChild(chip);
        });

        let availableLessons = new Set();
        this.state.selectedBooks.forEach(bId => {
            Object.keys(this.data.books[bId].lessons).forEach(lId => availableLessons.add(parseInt(lId)));
        });

        const lessonContainer = document.getElementById('lesson-chips');
        lessonContainer.innerHTML = '';
        
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
            lessonContainer.appendChild(chip);
        });
    }

    selectAllLessons() {
        let availableLessons = new Set();
        this.state.selectedBooks.forEach(bId => {
            Object.keys(this.data.books[bId].lessons).forEach(lId => availableLessons.add(parseInt(lId)));
        });
        availableLessons.forEach(lId => this.state.selectedLessons.add(lId.toString()));
        this.renderChips();
    }

    applyCourseSelection() {
        this.state.isReviewMode = false;
        if(window.innerWidth <= 800) this.toggleSidebar(); 
        
        // If we are currently managing review, refresh the dropdown
        if (this.state.currentMode === 'manage-review') {
            this.renderManageReview();
        } else {
            this.loadCurrentMode();
        }
    }

    toggleSidebar() {
        document.getElementById('sidebar').classList.toggle('open');
        document.getElementById('mobile-overlay').classList.toggle('active');
    }

    setMode(mode) {
        this.state.currentMode = mode;
        this.state.isReviewMode = false;
        
        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
        
        // Only highlight standard mode buttons, not the manage list gear
        if (mode !== 'manage-review') {
            const activeBtn = document.getElementById(`btn-${mode}`);
            if (activeBtn) activeBtn.classList.add('active');
        }

        if(window.innerWidth <= 800) this.toggleSidebar(); 
        this.loadCurrentMode();
    }

    startReviewMode() {
        if (this.state.progress.reviewQueue.length === 0) {
            alert("Your 'Study Again' list is empty. Great job!");
            return;
        }
        this.state.isReviewMode = true;
        this.state.currentMode = 'flashcards';
        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(`btn-flashcards`).classList.add('active');
        if(window.innerWidth <= 800) this.toggleSidebar();
        this.loadCurrentMode();
    }

    loadCurrentMode() {
        document.querySelectorAll('.study-view').forEach(v => v.classList.remove('active'));
        document.getElementById(`view-${this.state.currentMode}`).classList.add('active');

        // Special check for Manage Review screen
        if (this.state.currentMode === 'manage-review') {
            document.getElementById('current-title').innerText = "Manage Study List";
            document.getElementById('mode-current').innerText = '-';
            document.getElementById('mode-total').innerText = '-';
            this.renderManageReview();
            return;
        }

        if (this.state.isReviewMode) {
            this.state.studyQueue = [...this.state.progress.reviewQueue].sort(() => Math.random() - 0.5);
            document.getElementById('current-title').innerText = "Review Deck";
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

            document.getElementById('current-title').innerText = `Studying ${this.state.selectedBooks.size} Books, ${this.state.selectedLessons.size} Lessons`;
            
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

    // --- MANAGE STUDY AGAIN LIST ---
    renderManageReview() {
        const listUi = document.getElementById('review-list-ui');
        listUi.innerHTML = '';
        
        // Render List Items
        if (this.state.progress.reviewQueue.length === 0) {
            listUi.innerHTML = '<li style="justify-content:center; color: var(--text-muted);">List is empty!</li>';
        } else {
            this.state.progress.reviewQueue.forEach(item => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <div class="review-item-text">
                        ${item.word || item.simplified}
                        <span class="review-item-pinyin">${item.pinyin}</span>
                    </div>
                    <button class="remove-btn" onclick="app.removeFromReviewQueue('${item.id}')">Remove</button>
                `;
                listUi.appendChild(li);
            });
        }

        // Render Dropdown words to manually Add (pulls from selected books/lessons)
        const selectUi = document.getElementById('add-review-select');
        selectUi.innerHTML = '<option value="">-- Add a word from current selected lessons --</option>';
        
        let aggregatedVocab = [];
        this.state.selectedBooks.forEach(bId => {
            const book = this.data.books[bId];
            if (!book) return;
            this.state.selectedLessons.forEach(lId => {
                if (book.lessons[lId]) aggregatedVocab.push(...book.lessons[lId].vocab);
            });
        });

        // Deduplicate and filter out words already in queue
        const uniqueVocab = Array.from(new Map(aggregatedVocab.map(item => [item.id, item])).values());
        uniqueVocab.forEach(item => {
            if (!this.state.progress.reviewQueue.some(r => r.id === item.id)) {
                const opt = document.createElement('option');
                opt.value = item.id;
                opt.innerText = `${item.word || item.simplified} (${item.pinyin}) - ${item.definition || item.english || ''}`;
                selectUi.appendChild(opt);
            }
        });
    }

    removeFromReviewQueue(id) {
        this.state.progress.reviewQueue = this.state.progress.reviewQueue.filter(i => i.id !== id);
        this.saveProgress();
        this.renderManageReview();
    }

    clearReviewQueue() {
        if(confirm("Are you sure you want to completely clear your Study Again list?")) {
            this.state.progress.reviewQueue = [];
            this.saveProgress();
            this.renderManageReview();
        }
    }

    addSelectedToReview() {
        const selectUi = document.getElementById('add-review-select');
        const selectedId = selectUi.value;
        if (!selectedId) return;

        // Search our entire vocabulary set to find the matching item object
        let itemToAdd = null;
        for (let bId in this.data.books) {
            for (let lId in this.data.books[bId].lessons) {
                const found = this.data.books[bId].lessons[lId].vocab.find(v => v.id === selectedId);
                if (found) itemToAdd = found;
            }
        }

        if (itemToAdd && !this.state.progress.reviewQueue.some(i => i.id === itemToAdd.id)) {
            this.state.progress.reviewQueue.unshift(itemToAdd); // Adds to the top of the list
            this.saveProgress();
            this.renderManageReview();
        }
    }

    // --- RENDER STUDY ITEMS ---
    renderCurrentItem() {
        if (this.state.studyQueue.length === 0) {
            this.showEmptyState();
            return;
        }
        if (this.state.currentIndex >= this.state.studyQueue.length) {
            this.showCompletionScreen();
            return;
        }

        document.getElementById('mode-current').innerText = this.state.currentIndex + 1;
        document.getElementById('mode-total').innerText = this.state.studyQueue.length;

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
        document.getElementById('completion-title').innerText = "Nothing Selected";
        document.getElementById('completion-desc').innerText = "There are no words or sentences for the current selection. Try checking different boxes!";
        document.getElementById('mode-current').innerText = '-';
        document.getElementById('mode-total').innerText = '-';
    }

    showCompletionScreen() {
        document.querySelectorAll('.study-view').forEach(v => v.classList.remove('active'));
        document.getElementById('view-complete').classList.add('active');
        document.getElementById('completion-title').innerText = "Session Complete";
        document.getElementById('completion-desc').innerText = "Excellent work. Adjust your selections or change modes in the menu.";
        document.getElementById('mode-current').innerText = '-';
        document.getElementById('mode-total').innerText = '-';
        this.triggerConfetti();
    }

    // --- FLASHCARDS ---
    renderFlashcard() {
        const item = this.state.studyQueue[this.state.currentIndex];
        document.getElementById('fc-front-text').innerText = item.word || item.simplified || "?";
        document.getElementById('fc-pinyin').innerText = item.pinyin || "";
        document.getElementById('fc-meaning').innerText = item.definition || item.meaning || item.english || "";
        
        const card = document.getElementById('flashcard');
        card.classList.remove('is-flipped');
        card.style.transform = `translateX(0px) rotate(0deg)`;
        card.style.opacity = '1';
    }

    flipCard() { document.getElementById('flashcard').classList.toggle('is-flipped'); }

    handleSwipe(direction) {
        const card = document.getElementById('flashcard');
        const moveX = direction === 'right' ? 300 : -300;
        card.style.transition = 'transform 0.4s ease, opacity 0.4s ease';
        card.style.transform = `translateX(${moveX}px) rotate(${moveX/10}deg)`;
        card.style.opacity = '0';

        setTimeout(() => {
            const item = this.state.studyQueue[this.state.currentIndex];
            if (direction === 'right') { 
                if (!this.state.progress.mastered.some(i => i.id === item.id)) {
                    this.state.progress.mastered.push(item);
                    this.state.progress.dailyMastered += 1;
                }
                this.state.progress.reviewQueue = this.state.progress.reviewQueue.filter(i => i.id !== item.id);
            } else { 
                if (!this.state.progress.reviewQueue.some(i => i.id === item.id)) {
                    this.state.progress.reviewQueue.push(item);
                }
            }
            this.saveProgress();
            card.style.transition = 'none';
            this.nextItem();
        }, 400);
    }

    // --- WRITING ---
    renderWritingChar() {
        const char = this.state.studyQueue[this.state.currentIndex];
        const charData = window.CHARS_DATA ? window.CHARS_DATA.find(c => c.hanzi === char) : null;
        document.getElementById('wr-pinyin').innerText = charData ? charData.pinyin : char;
        document.getElementById('wr-meaning').innerText = charData ? charData.meaning : '';

        const targetDiv = document.getElementById('character-target-div');
        targetDiv.innerHTML = ''; 
        
        const isDark = document.body.classList.contains('dark-mode');
        const mainColor = isDark ? '#E8E6E1' : '#2C2B29'; 
        const radicalColor = isDark ? '#D6D2C4' : '#7A7873'; 

        this.hanziWriter = HanziWriter.create('character-target-div', char, {
            width: 250, height: 250, padding: 15,
            strokeColor: mainColor,
            radicalColor: radicalColor, 
            delayBetweenStrokes: 200, 
            showOutline: true,
            outlineColor: isDark ? '#3B3A38' : '#E8E6E1'
        });
    }

    // --- SENTENCES ---
    renderSentence() {
        const s = this.state.studyQueue[this.state.currentIndex];
        document.getElementById('sn-chinese').innerText = s.sentence || "";
        document.getElementById('sn-pinyin').innerText = s.pinyin || "";
        document.getElementById('sn-english').innerText = s.english || "";
        document.getElementById('sn-english').classList.add('hidden');
        document.getElementById('reveal-translation-btn').style.display = 'inline-block';
    }
    revealSentence() {
        document.getElementById('sn-english').classList.remove('hidden');
        document.getElementById('reveal-translation-btn').style.display = 'none';
    }

    // --- QUIZ ---
    renderQuiz() {
        const item = this.state.studyQueue[this.state.currentIndex];
        document.getElementById('qz-word').innerText = item.word || item.simplified || "";
        
        const allDefs = this.state.studyQueue.map(i => i.definition || i.meaning || i.english);
        let options = new Set([item.definition || item.meaning || item.english]);
        while(options.size < 4 && options.size < allDefs.length) {
            options.add(allDefs[Math.floor(Math.random() * allDefs.length)]);
        }
        
        const optionsContainer = document.getElementById('qz-options');
        optionsContainer.innerHTML = '';
        document.getElementById('quiz-feedback').classList.add('hidden');

        Array.from(options).sort(() => Math.random() - 0.5).forEach(opt => {
            if (!opt) return;
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.innerText = opt;
            btn.onclick = () => {
                document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
                const isCorrect = opt === (item.definition || item.meaning || item.english);
                btn.classList.add(isCorrect ? 'correct' : 'wrong');
                if(!isCorrect) document.querySelectorAll('.option-btn').forEach(b => {
                    if (b.innerText === (item.definition || item.meaning || item.english)) b.classList.add('correct');
                });
                setTimeout(() => this.nextItem(), 1500);
            };
            optionsContainer.appendChild(btn);
        });
    }

    playAudio(text) {
        if ('speechSynthesis' in window) {
            const msg = new SpeechSynthesisUtterance(text);
            msg.lang = 'zh-TW'; 
            window.speechSynthesis.speak(msg);
        }
    }

    // --- STORAGE & UTILS ---
    loadProgress() {
        const saved = localStorage.getItem('aladsProgress');
        let prog = saved ? JSON.parse(saved) : { mastered: [], reviewQueue: [], streak: 0, lastDate: null, dailyMastered: 0 };
        const today = new Date().toDateString();
        if (prog.lastDate !== today) {
            prog.streak = prog.lastDate === new Date(Date.now() - 86400000).toDateString() ? prog.streak + 1 : (prog.streak===0?0:1);
            prog.dailyMastered = 0; prog.lastDate = today;
            localStorage.setItem('aladsProgress', JSON.stringify(prog));
        }
        return prog;
    }

    saveProgress() {
        localStorage.setItem('aladsProgress', JSON.stringify(this.state.progress));
        this.updateProgressUI();
    }

    updateProgressUI() {
        document.getElementById('streak-count').innerText = this.state.progress.streak;
        document.getElementById('review-count').innerText = this.state.progress.reviewQueue.length;
        document.getElementById('daily-mastered').innerText = this.state.progress.dailyMastered;
        document.getElementById('daily-progress-bar').style.width = `${Math.min((this.state.progress.dailyMastered / 10) * 100, 100)}%`;
    }

    applyDarkMode() { if (localStorage.getItem('aladsDarkMode') === 'true') document.body.classList.add('dark-mode'); }
    toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('aladsDarkMode', document.body.classList.contains('dark-mode'));
        if(this.state.currentMode === 'writing') this.renderWritingChar();
    }

    setupEventListeners() {
        document.getElementById('dark-mode-btn').addEventListener('click', () => this.toggleDarkMode());
        
        document.addEventListener('keydown', (e) => {
            if (this.state.currentMode !== 'flashcards') return;
            if (e.code === 'Space') { e.preventDefault(); this.flipCard(); }
            if (e.code === 'ArrowRight') this.handleSwipe('right');
            if (e.code === 'ArrowLeft') this.handleSwipe('left');
        });

        const card = document.getElementById('flashcard');
        const startDrag = (e) => { this.swipeState.isDragging = true; this.swipeState.startX = e.type.includes('mouse') ? e.pageX : e.touches[0].pageX; card.style.transition = 'none'; };
        const onDrag = (e) => {
            if (!this.swipeState.isDragging) return;
            const deltaX = (e.type.includes('mouse') ? e.pageX : e.touches[0].pageX) - this.swipeState.startX;
            card.style.transform = `translateX(${deltaX}px) rotate(${deltaX * 0.05}deg)`;
        };
        const endDrag = (e) => {
            if (!this.swipeState.isDragging) return;
            this.swipeState.isDragging = false;
            const deltaX = (e.type.includes('mouse') ? e.pageX : (e.changedTouches ? e.changedTouches[0].pageX : this.swipeState.startX)) - this.swipeState.startX;
            if (deltaX > 100) this.handleSwipe('right');
            else if (deltaX < -100) this.handleSwipe('left');
            else { card.style.transition = 'transform 0.3s'; card.style.transform = `translateX(0px) rotate(0deg)`; }
        };
        card.addEventListener('mousedown', startDrag); document.addEventListener('mousemove', onDrag); document.addEventListener('mouseup', endDrag);
        card.addEventListener('touchstart', startDrag); document.addEventListener('touchmove', onDrag); document.addEventListener('touchend', endDrag);
    }

    triggerConfetti() {
        const canvas = document.getElementById('confetti-canvas');
        canvas.style.display = 'block'; const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth; canvas.height = window.innerHeight;
        let particles = Array.from({length:100}, () => ({x: Math.random()*canvas.width, y: Math.random()*canvas.height - canvas.height, w: Math.random()*10+5, h: Math.random()*10+5, c: `hsl(${40 + Math.random()*30}, 80%, 50%)`, vy: Math.random()*5+2})); 
        const render = () => {
            ctx.clearRect(0,0, canvas.width, canvas.height);
            particles.forEach(p => { ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, p.w, p.h); p.y += p.vy; });
            if (particles.some(p => p.y < canvas.height)) requestAnimationFrame(render); else canvas.style.display = 'none';
        }; render();
    }
}

const app = new ChineseApp();
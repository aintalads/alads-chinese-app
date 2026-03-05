class ChineseApp {
    constructor() {
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
        
        window.speechSynthesis.getVoices(); 
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
            const t = document.getElementById('current-title');
            if(t) t.innerText = "⚙️ Manage Study List";
            const mc = document.getElementById('mode-current');
            if(mc) mc.innerText = '-';
            const mt = document.getElementById('mode-total');
            if(mt) mt.innerText = '-';
            this.renderManageReview();
            return;
        }

        if (this.state.isReviewMode) {
            this.state.studyQueue = [...this.state.progress.reviewQueue].sort(() => Math.random() - 0.5);
            const t = document.getElementById('current-title');
            if(t) t.innerText = "🔄 Review Deck";
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

            const t = document.getElementById('current-title');
            if(t) t.innerText = `📚 Study Session`;
            
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

        const selectUi = document.getElementById('add-review-select');
        if(!selectUi) return;
        selectUi.innerHTML = '<option value="">➕ Add a word from current selected lessons...</option>';
        let aggregatedVocab = [];
        this.state.selectedBooks.forEach(bId => {
            const book = this.data.books[bId];
            if (!book) return;
            this.state.selectedLessons.forEach(lId => {
                if (book.lessons[lId]) aggregatedVocab.push(...book.lessons[lId].vocab);
            });
        });

        const uniqueVocab = Array.from(new Map(aggregatedVocab.map(item => [item.id, item])).values());
        uniqueVocab.forEach(item => {
            if (!this.state.progress.reviewQueue.some(r => r && r.id === item.id)) {
                const opt = document.createElement('option');
                opt.value = item.id;
                opt.innerText = `${item.word || item.simplified} (${item.pinyin})`;
                selectUi.appendChild(opt);
            }
        });
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

    addSelectedToReview() {
        const selectUi = document.getElementById('add-review-select');
        if(!selectUi) return;
        const selectedId = selectUi.value;
        if (!selectedId) return;
        let itemToAdd = null;
        for (let bId in this.data.books) {
            for (let lId in this.data.books[bId].lessons) {
                const found = this.data.books[bId].lessons[lId].vocab.find(v => v.id === selectedId);
                if (found) itemToAdd = found;
            }
        }
        if (itemToAdd) {
            this.state.progress.reviewQueue.unshift(itemToAdd);
            this.saveProgress();
            this.renderManageReview();
        }
    }

    renderCurrentItem() {
        if (this.state.studyQueue.length === 0) {
            this.showEmptyState();
            return;
        }
        if (this.state.currentIndex >= this.state.studyQueue.length) {
            this.showCompletionScreen();
            return;
        }

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
        const vc = document.getElementById('view-complete');
        if(vc) vc.classList.add('active');
        const ct = document.getElementById('completion-title');
        if(ct) ct.innerText = "Empty Selection";
    }

    showCompletionScreen() {
        if (this.state.isAutoPlaying) this.toggleAutoPlaySlideshow(); 
        if (this.state.isSentenceAutoPlaying) this.toggleSentenceSlideshow();
        document.querySelectorAll('.study-view').forEach(v => v.classList.remove('active'));
        const vc = document.getElementById('view-complete');
        if(vc) vc.classList.add('active');
        const ct = document.getElementById('completion-title');
        if(ct) ct.innerText = "Session Complete 🏆";
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

    playAudio(text, lang = 'zh-TW', callback = null) {
        if (!text) return;
        window.speechSynthesis.cancel(); 
        const msg = new SpeechSynthesisUtterance(text);
        msg.lang = lang;
        msg.rate = 0.9; 
        msg.onend = () => { if (callback) callback(); };
        window.speechSynthesis.speak(msg);
    }

    playEnglishAudio(text) {
        this.playAudio(text, 'en-US');
    }

    renderFlashcard() {
        var item = this.state.studyQueue[this.state.currentIndex];
        if (!item) return; 
        
        const fText = document.getElementById('fc-front-text');
        if(fText) fText.innerText = item.word || item.simplified || "?";
        const pText = document.getElementById('fc-pinyin');
        if(pText) pText.innerText = item.pinyin || "";
        const mText = document.getElementById('fc-meaning');
        if(mText) mText.innerText = item.definition || item.meaning || item.english || "";
        
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

        if (this.state.autoAudio && !this.state.isAutoPlaying) {
             this.playAudio(item.word || item.simplified);
        }

        var knownCount = 0; 
        var studyCount = 0;
        if (this.state.history) {
            this.state.history.forEach(h => {
                if (h.direction === 'right') knownCount++;
                if (h.direction === 'left') studyCount++;
            });
        }

        var studySpan = document.getElementById('stat-study-count');
        var knownSpan = document.getElementById('stat-known-count');
        if (studySpan) studySpan.innerText = studyCount;
        if (knownSpan) knownSpan.innerText = knownCount;
    }

    flipCard() { 
        const card = document.getElementById('flashcard');
        if(card) card.classList.toggle('is-flipped'); 
    }

    handleSwipe(direction) {
        if (this.state.isAnimating) return; 
        this.state.isAnimating = true;
        const item = this.state.studyQueue[this.state.currentIndex];
        
        if (item) {
            this.state.history.push({ index: this.state.currentIndex, item: item, direction: direction });
        } else {
            this.state.isAnimating = false; this.nextItem(); return;
        }

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

    goBack() {
        if (!this.state.history || this.state.history.length === 0) {
            console.log("No history to undo");
            return;
        }
        
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
        const item = this.state.studyQueue[this.state.currentIndex];
        this.playAudio(item.word || item.simplified);

        // DELAY UPDATE: Faster Flip
        this.slideshowTimeout = setTimeout(() => {
            if (!this.state.isAutoPlaying) return;
            this.flipCard();
            const eng = item.definition || item.meaning || item.english;
            this.playEnglishAudio(eng);

            // DELAY UPDATE: Faster Swipe
            this.slideshowTimeout = setTimeout(() => {
                if (!this.state.isAutoPlaying) return;
                this.handleSwipe('right');
                
                // DELAY UPDATE: Faster Next Card
                this.slideshowTimeout = setTimeout(() => this.runSlideshowStep(), 800);
            }, 2000); 
        }, 1500); 
    }

    renderWritingChar() {
        const char = this.state.studyQueue[this.state.currentIndex];
        const charData = window.CHARS_DATA ? window.CHARS_DATA.find(c => c.hanzi === char) : null;
        const wp = document.getElementById('wr-pinyin');
        if(wp) wp.innerText = charData ? charData.pinyin : char;
        const wm = document.getElementById('wr-meaning');
        if(wm) wm.innerText = charData ? charData.meaning : '';

        const targetDiv = document.getElementById('character-target-div');
        if(!targetDiv) return;
        targetDiv.innerHTML = ''; 
        const isDark = document.body.classList.contains('dark-mode');

        this.hanziWriter = HanziWriter.create('character-target-div', char, {
            width: 250, height: 250, padding: 15,
            strokeColor: isDark ? '#E8E6E1' : '#000000',
            radicalColor: isDark ? '#5EBBBA' : '#0C7A79', 
            showOutline: !this.state.outlineHidden,
            outlineColor: isDark ? '#204E59' : '#e0e0e0'
        });
        
        const btn = document.getElementById('toggle-outline-btn');
        if(btn) btn.innerText = this.state.outlineHidden ? "👁️ Show Outline" : "🙈 Hide Outline";
        this.hanziWriter.quiz();
    }

    toggleOutline() {
        if (!this.hanziWriter) return;
        this.state.outlineHidden = !this.state.outlineHidden;
        const btn = document.getElementById('toggle-outline-btn');
        if(!btn) return;
        if (this.state.outlineHidden) {
            this.hanziWriter.hideOutline();
            btn.innerText = "👁️ Show Outline";
        } else {
            this.hanziWriter.showOutline();
            btn.innerText = "🙈 Hide Outline";
        }
    }

    renderSentence() {
        const s = this.state.studyQueue[this.state.currentIndex];
        if (!s) return;
        const sc = document.getElementById('sn-chinese');
        if(sc) sc.innerText = s.sentence || "";
        const sp = document.getElementById('sn-pinyin');
        if(sp) sp.innerText = s.pinyin || "";
        const se = document.getElementById('sn-english');
        if(se) {
            se.innerText = s.english || "";
            se.classList.add('hidden');
        }
        const rb = document.getElementById('reveal-translation-btn');
        if(rb) rb.style.display = 'inline-block';
        if (this.state.autoAudio && !this.state.isSentenceAutoPlaying) this.playAudio(s.sentence);
    }

    revealSentence() {
        const se = document.getElementById('sn-english');
        if(se) se.classList.remove('hidden');
        const rb = document.getElementById('reveal-translation-btn');
        if(rb) rb.style.display = 'none';
    }

    toggleSentenceSlideshow() {
        this.state.isSentenceAutoPlaying = !this.state.isSentenceAutoPlaying;
        const btn = document.getElementById('sn-auto-play-btn');
        if(!btn) return;
        if (this.state.isSentenceAutoPlaying) {
            btn.innerText = "⏸️ Stop Slideshow";
            btn.classList.add('active');
            this.runSentenceSlideshowStep();
        } else {
            btn.innerText = "▶️ Slideshow";
            btn.classList.remove('active');
            clearTimeout(this.sentenceSlideshowTimeout);
        }
    }

    runSentenceSlideshowStep() {
        if (!this.state.isSentenceAutoPlaying || this.state.currentIndex >= this.state.studyQueue.length) {
            if (this.state.isSentenceAutoPlaying) this.toggleSentenceSlideshow();
            return;
        }

        const s = this.state.studyQueue[this.state.currentIndex];
        
        this.playAudio(s.sentence, 'zh-TW', () => {
            this.sentenceSlideshowTimeout = setTimeout(() => {
                if (!this.state.isSentenceAutoPlaying) return;
                this.revealSentence(); 
                
                this.playAudio(s.english, 'en-US', () => {
                    this.sentenceSlideshowTimeout = setTimeout(() => {
                        if (!this.state.isSentenceAutoPlaying) return;
                        this.nextItem();
                        this.runSentenceSlideshowStep();
                    }, 3000);
                });
            }, 1200);
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
        if (scoreUi && this.state.studyQueue) {
            scoreUi.innerText = `🏆 Score: ${this.state.score || 0} / ${this.state.studyQueue.length}`;
        }

        var qType = qTypeSelect ? qTypeSelect.value : 'zh';
        var aType = aTypeSelect ? aTypeSelect.value : 'mc';

        var questionText = "";
        var correctMeaning = "";
        
        if (qType === 'zh') {
            questionText = item.word || item.simplified;
            correctMeaning = item.definition || item.meaning || item.english || "";
        } else if (qType === 'py') {
            questionText = item.pinyin;
            correctMeaning = item.definition || item.meaning || item.english || "";
        } else if (qType === 'en') {
            questionText = item.definition || item.meaning || item.english;
            correctMeaning = item.pinyin || item.word || item.simplified || "";
        }

        var wordEl = document.getElementById('qz-word');
        if (wordEl) wordEl.innerText = questionText;
        
        var soundBtn = document.getElementById('qz-sound-btn');
        if(soundBtn) soundBtn.onclick = () => this.playAudio(item.word || item.simplified);

        var optionsContainer = document.getElementById('qz-options');
        if (!optionsContainer) return;
        optionsContainer.innerHTML = ''; 

        var cleanText = (str) => {
            if (!str) return "";
            return str.normalize("NFD")
                      .replace(/[\u0300-\u036f]/g, "")
                      .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "")
                      .toLowerCase();
        };

        if (aType === 'type') {
            optionsContainer.style.display = 'block';
            
            var inputField = document.createElement('input');
            inputField.type = 'text';
            inputField.className = 'quiz-input';
            inputField.placeholder = `Type the ${qType === 'en' ? 'Pinyin / Chinese' : 'English'}...`;

            var submitBtn = document.createElement('button');
            submitBtn.innerText = 'Submit Answer'; 
            submitBtn.className = 'option-btn'; 
            submitBtn.style.width = '100%';
            submitBtn.style.maxWidth = '500px';
            submitBtn.style.display = 'block';
            submitBtn.style.margin = '0 auto';

            var feedback = document.createElement('div');
            feedback.className = 'quiz-feedback';

            optionsContainer.appendChild(inputField);
            optionsContainer.appendChild(submitBtn);
            optionsContainer.appendChild(feedback);

            setTimeout(() => inputField.focus(), 100);

            var checkAnswer = () => {
                var cleanedUserInput = cleanText(inputField.value);
                var correctMeaningsList = correctMeaning.split(/[,/;]/).map(m => cleanText(m));
                
                var isCorrect = correctMeaningsList.some(m => m === cleanedUserInput || (m.includes(cleanedUserInput) && cleanedUserInput.length > 2));

                if (isCorrect) {
                    this.state.score = (this.state.score || 0) + 1;
                    feedback.innerHTML = `✅ <b>Correct!</b><br><span style="font-size:0.9rem; color:#155724;">Answer: ${correctMeaning}</span>`;
                    feedback.style.backgroundColor = '#d4edda';
                    feedback.style.color = '#155724';
                    inputField.style.borderColor = '#28a745';
                } else {
                    feedback.innerHTML = `❌ <b>Incorrect.</b><br>Right answer: <b>${correctMeaning}</b>`;
                    feedback.style.backgroundColor = '#f8d7da';
                    feedback.style.color = '#721c24';
                    inputField.style.borderColor = '#dc3545';
                }
                var updateScoreUi = document.getElementById('quiz-score-ui');
                if (updateScoreUi) updateScoreUi.innerText = `🏆 Score: ${this.state.score} / ${this.state.studyQueue.length}`;
                
                submitBtn.disabled = true; inputField.disabled = true;
                
                // DELAY UPDATE: Faster Quiz Typing Transition
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
                        btn.style.backgroundColor = '#d4edda'; btn.style.borderColor = '#28a745';
                        btn.style.color = '#155724';
                        this.state.score = (this.state.score || 0) + 1;
                    } else {
                        btn.style.backgroundColor = '#f8d7da'; btn.style.borderColor = '#dc3545';
                        btn.style.color = '#721c24';
                        Array.from(optionsContainer.children).forEach(child => {
                            if (child.innerText.includes(item.definition || item.word || item.english)) {
                                child.style.backgroundColor = '#d4edda'; child.style.borderColor = '#28a745';
                            }
                        });
                    }
                    var updateScoreUi = document.getElementById('quiz-score-ui');
                    if (updateScoreUi) updateScoreUi.innerText = `🏆 Score: ${this.state.score} / ${this.state.studyQueue.length}`;
                    
                    // DELAY UPDATE: Faster Quiz Multiple Choice Transition
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
        const s = document.getElementById('streak-count');
        if(s) s.innerText = this.state.progress.streak;
        const r = document.getElementById('review-count');
        if(r) r.innerText = this.state.progress.reviewQueue.length;
        const d = document.getElementById('daily-mastered');
        if(d) d.innerText = this.state.progress.dailyMastered;
        const pb = document.getElementById('daily-progress-bar');
        if(pb) pb.style.width = `${Math.min((this.state.progress.dailyMastered / 10) * 100, 100)}%`;
    }

    applyDarkMode() { if (localStorage.getItem('aladsDarkMode') === 'true') document.body.classList.add('dark-mode'); }
    toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('aladsDarkMode', document.body.classList.contains('dark-mode'));
        if(this.state.currentMode === 'writing') this.renderWritingChar();
    }

    setupEventListeners() {
        const dmBtn = document.getElementById('dark-mode-btn');
        if(dmBtn) dmBtn.addEventListener('click', () => this.toggleDarkMode());
        
        document.addEventListener('keydown', (e) => {
            if (this.state.currentMode !== 'flashcards') return;
            const card = document.getElementById('flashcard');
            
            if (e.code === 'Space') { 
                e.preventDefault(); 
                this.flipCard(); 
            }
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

        activeCard.addEventListener('pointerdown', (e) => {
            if(e.target.tagName.toLowerCase() === 'button') return; 
            this.swipeState.isDragging = true;
            startX = e.clientX; startTime = Date.now();
            activeCard.style.transition = 'none';
            activeCard.setPointerCapture(e.pointerId); 
        });
        
        activeCard.addEventListener('pointermove', (e) => {
            if (!this.swipeState.isDragging) return;
            const deltaX = e.clientX - startX;
            activeCard.style.transform = `translateX(${deltaX}px) rotate(${deltaX * 0.05}deg)`;
            
            if (deltaX > 20) {
                activeCard.style.boxShadow = `0 0 40px rgba(0, 255, 0, ${Math.min(deltaX/100, 0.8)})`;
            } else if (deltaX < -20) {
                activeCard.style.boxShadow = `0 0 40px rgba(255, 0, 0, ${Math.min(Math.abs(deltaX)/100, 0.8)})`;
            } else {
                activeCard.style.boxShadow = 'none';
            }
        });
        
        activeCard.addEventListener('pointerup', (e) => {
            if (!this.swipeState.isDragging) return;
            this.swipeState.isDragging = false;
            activeCard.releasePointerCapture(e.pointerId);
            
            const deltaX = e.clientX - startX;
            activeCard.style.boxShadow = 'none'; 
            
            if (Math.abs(deltaX) < 15 && (Date.now() - startTime) < 400) {
                this.flipCard();
            } else if (deltaX > 100) {
                this.handleSwipe('right');
            } else if (deltaX < -100) {
                this.handleSwipe('left');
            } else { 
                activeCard.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease'; 
                activeCard.style.transform = 'translateX(0) rotate(0)'; 
            }
        });
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

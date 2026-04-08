class ChineseApp {


buildSentencesUI(item) {
    try {
        const container = document.getElementById('fc-sentences-container');
        const oldBox = document.getElementById('fc-example-box'); 
        if (!container) return;

        // 🌟 INTEGRATED SCROLL HINT LOGIC
        const scrollDownBtn = document.querySelector('.scroll-down-hint');
        
        // Hide it by default at the start of every card load
        if (scrollDownBtn) {
            scrollDownBtn.style.setProperty('display', 'none', 'important');
            scrollDownBtn.style.opacity = '1'; // Reset opacity for the next card
        }

        const scrollArea = document.querySelector('.flashcard-back') || document.querySelector('.card-back');
        if (scrollArea) {
            scrollArea.style.setProperty('height', '100%', 'important');
            scrollArea.style.setProperty('max-height', '75vh', 'important'); 
            scrollArea.style.setProperty('overflow-y', 'auto', 'important');
            scrollArea.style.setProperty('touch-action', 'pan-y', 'important');
            scrollArea.scrollTop = 0; 

            // 🌟 Hide the button automatically when the user scrolls down
            if (scrollDownBtn) {
                scrollArea.addEventListener('scroll', () => {
                    if (scrollArea.scrollTop > 50) {
                        scrollDownBtn.style.opacity = '0';
                        setTimeout(() => { 
                            if(scrollArea.scrollTop > 50) scrollDownBtn.style.display = 'none'; 
                        }, 300);
                    }
                }, { passive: true });
            }
        }

        // Prevent card flip
        container.onclick = (e) => e.stopPropagation();

        const targetWord = item.word || item.simplified || item.character || "";
        if (!targetWord) {
            container.innerHTML = '';
            if (oldBox) oldBox.style.setProperty('display', 'block', 'important'); 
            return;
        }

        // ... [Matching Logic Stays Exactly the same] ...
        const currentBookNum = parseInt(item.book_id); 
        const currentLessonNum = parseInt(item.lesson_id);
        let matchingSentences = [];
        
        if (window.sentences && Array.isArray(window.sentences)) {
            window.sentences.forEach(s => {
                const zh = String(s.sentence || "");
                if (zh.includes(targetWord)) {
                    if (!matchingSentences.some(m => String(m.sentence) === zh)) {
                        const dbBookNum = parseInt(String(s.book_id).replace(/\D/g, ''));
                        const dbLessonNum = parseInt(s.lesson_id);
                        matchingSentences.push({
                            sentence: zh,
                            pinyin: s.pinyin || "",
                            english: s.english || "",
                            isCurrentLesson: (dbBookNum === currentBookNum && dbLessonNum === currentLessonNum)
                        });
                    }
                }
            });
        }

        matchingSentences.sort((a, b) => b.isCurrentLesson - a.isCurrentLesson);
        matchingSentences = matchingSentences.slice(0, 2);

        if (matchingSentences.length === 0) {
            container.innerHTML = ''; 
            if (oldBox) oldBox.style.setProperty('display', 'block', 'important'); 
            return;
        }

        // 🌟 SHOW THE BUTTON: We only show it if sentences were actually found
        if (scrollDownBtn) {
            scrollDownBtn.style.setProperty('display', 'flex', 'important');
        }

        if (oldBox) {
            oldBox.style.setProperty('display', 'none', 'important');
        }

        // ... [HTML Generation Stays Exactly the same] ...
        let sentencesHTML = matchingSentences.map((match, index) => {
            const separator = index !== matchingSentences.length - 1 
                ? 'border-bottom: 1px dashed rgba(0,0,0,0.1); padding-bottom: 25px; margin-bottom: 25px;' 
                : 'padding-bottom: 10px; margin-bottom: 10px;';

            return `
            <div style="${separator}">
                <div class="text-chinese" style="font-size: 1.8rem !important; font-weight: normal !important; white-space: normal !important; word-wrap: break-word !important; color: var(--primary-color); line-height: 1.5 !important; margin-bottom: 8px;">${match.sentence}</div>
                <div class="text-pinyin" style="font-size: 0.6rem !important; white-space: normal !important; word-wrap: break-word !important; color: var(--text-muted); margin-bottom: 8px;">${match.pinyin}</div>
                <div class="text-english" style="font-size: 0.8rem !important; white-space: normal !important; word-wrap: break-word !important; color: #444;">${match.english}</div>
            </div>
            `;
        }).join('');

        container.innerHTML = `
            <div style="margin-top: 150px !important; margin-bottom: 80px !important; padding: 0 15px; background: transparent !important; border: none !important; box-shadow: none !important;">
                <div style="font-weight: bold; color: var(--text-muted); margin-bottom: 25px; font-size: 0.9rem !important; text-transform: uppercase; letter-spacing: 2px; text-align: center;">
                    — Examples —
                </div>
                ${sentencesHTML}
            </div>
        `;
        
        container.style.setProperty('margin-top', '0px', 'important');

    } catch (error) {
        console.error("Error building sentences UI:", error);
    }
}
    // 💾 Saves the current live study session
    saveActiveSession() {
        const sessionData = {
            studyQueue: this.state.studyQueue,
            currentIndex: this.state.currentIndex,
            currentMode: this.state.currentMode,
            score: this.state.score || 0,
            lastUpdated: Date.now()
        };
        localStorage.setItem('activeStudySession', JSON.stringify(sessionData));
    }

    // 🎤 Scans the device for Chinese voices
    initVoices() {
        const loadAvailableVoices = () => {
            this.voices = window.speechSynthesis.getVoices();
            const selector = document.getElementById('voice-selector');
            if (!selector) return;

            // Filter for only Chinese voices (Mandarin, Taiwanese, etc.)
            const zhVoices = this.voices.filter(v => v.lang.includes('zh'));
            
            if (zhVoices.length === 0) {
                selector.innerHTML = '<option value="">Default Voice</option>';
                return;
            }

            selector.innerHTML = ''; // Clear "Loading..."
            
            zhVoices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.voiceURI;
                
                // Clean up the name so it looks nice (removes "Microsoft", "Google", etc.)
                let cleanName = voice.name.replace(/Microsoft|Google|Apple|Network/ig, '').trim();
                if (cleanName === "") cleanName = "Standard Voice";
                
                // Show if it's TW, CN, or HK
                let region = voice.lang.includes('TW') ? '🇹🇼' : voice.lang.includes('CN') ? '🇨🇳' : '🇭🇰';
                option.textContent = `${region} ${cleanName}`;
                
                if (this.selectedVoiceURI === voice.voiceURI) {
                    option.selected = true;
                }
                selector.appendChild(option);
            });

            // If they haven't picked one yet, default to the first available
            if (!this.selectedVoiceURI && zhVoices.length > 0) {
                this.selectedVoiceURI = zhVoices[0].voiceURI;
            }
        };

        // Browsers load voices asynchronously, so we must trigger it this way:
        loadAvailableVoices();
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = loadAvailableVoices;
        }
    }

    // 💾 Saves their choice when they use the dropdown
    changeVoice(voiceURI) {
        this.selectedVoiceURI = voiceURI;
        localStorage.setItem('preferredChineseVoice', voiceURI);
        
        // Optional: Play a tiny test sound so they know what it sounds like!
        this.playTTS("你好", "zh-TW"); 
    }
    

    // 📥 Loads the session if it exists
   loadActiveSession() {
        const saved = localStorage.getItem('activeStudySession');
        if (!saved) return false;

        try {
            const data = JSON.parse(saved);
            
            // Optional: If the session is older than 12 hours, ignore it
            const twelveHours = 12 * 60 * 60 * 1000;
            if (Date.now() - data.lastUpdated > twelveHours) {
                localStorage.removeItem('activeStudySession');
                return false;
            }

            this.state.studyQueue = data.studyQueue;
            this.state.currentIndex = data.currentIndex;
            this.state.currentMode = data.currentMode;
            this.state.score = data.score;
            
            // ⏱️ START TIMER HERE (Returning to saved session)
window.sessionStartTime = Date.now();
            
            // Switch to the saved mode and show the item
            this.setMode(this.state.currentMode);
            this.renderCurrentItem();
            
            if (typeof window.completeLoadingScreen === 'function') {
                window.completeLoadingScreen();
            }

            return true;
        } catch (e) {
            console.error("Error restoring session", e);
            return false;
        }
    }

    // 🔍 Scans all books for the clicked character
    // 🔍 Scans all books for the clicked character
   // 🔍 Scans all books for the clicked character
// 🔍 Scans all books for the clicked character (ORGANIZED BY BOOK)
  showCharacterOccurrences(targetChar, themeColor) {
        const modal = document.getElementById('char-search-modal');
        const targetTitleSpan = document.getElementById('char-search-target');
        if (!modal || !targetTitleSpan) return;

        // 1. Set Centered Title Text and Theme Colors
        targetTitleSpan.innerText = targetChar;
        document.getElementById('char-search-header').style.backgroundColor = themeColor;
        this.state.charMapSearchColor = themeColor; 

        // 2. Scan and Group by Book
        const resultsByBook = {};
        let totalMatches = 0;

        if (this.data && this.data.books) {
            for (const bookId in this.data.books) {
                // Get a clean book name (e.g., "HSK 1" or formatted Book ID)
                const bookName = this.data.books[bookId].title || bookId.replace(/_/g, ' ').toUpperCase();
                
                for (const lessonId in this.data.books[bookId].lessons) {
                    const vocab = this.data.books[bookId].lessons[lessonId].vocab;
                    if (vocab) {
                        // Find words in this lesson matching the character
                        const matches = vocab.filter(item => {
                            const word = item.word || item.simplified || "";
                            return word.includes(targetChar);
                        });
                        
                        if (matches.length > 0) {
                            if (!resultsByBook[bookName]) resultsByBook[bookName] = [];
                            resultsByBook[bookName] = resultsByBook[bookName].concat(matches);
                            totalMatches += matches.length;
                        }
                    }
                }
            }
        }

        // 3. Build the Grouped Accordion List
        const resultsEl = document.getElementById('char-search-results');
        if (totalMatches === 0) {
            resultsEl.innerHTML = `<div style="text-align:center; padding: 20px; color: var(--text-muted);">No occurrences found in your books.</div>`;
        } else {
            let html = '';
            let isFirst = true; // We will auto-expand the first book!

            for (const [bookName, items] of Object.entries(resultsByBook)) {
                
                // Remove duplicates in case a word appears multiple times in the same book
                const uniqueItems = Array.from(new Set(items.map(a => a.word || a.simplified)))
                    .map(word => items.find(a => (a.word || a.simplified) === word));

                // Build the Book Header
                html += `
                    <div class="book-group ${isFirst ? 'expanded' : ''}">
                        <div class="book-group-header" onclick="this.parentElement.classList.toggle('expanded'); app.playSound('swipe-right');" style="border-left: 4px solid ${themeColor}; padding: 12px 15px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <svg class="accordion-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                                <span class="book-title">${bookName}</span>
                            </div>
                            <span class="book-badge" style="background-color: ${themeColor}">${uniqueItems.length}</span>
                        </div>
                        <div class="book-group-content">
                            <div class="book-group-inner" style="max-height: 40vh; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; padding: 10px 15px;">
                `;
                
                // Build the floating table of words inside this book
                uniqueItems.forEach(item => {
                    const word = item.word || item.simplified || "";
                    const py = item.pinyin || "";
                    const en = item.meaning || item.english || "";
                    
                    // 🪄 Interactive Character Map (Laptop-Proofed + Fluid Sizing!)
                    const highlightedWord = word.split('').map(char => {
                        const isTarget = char === targetChar;
                        const color = isTarget ? themeColor : 'inherit';
                        const weight = isTarget ? 'bold' : 'normal';
                        // 📱 Fluid sizing: shrinks gracefully on small mobile screens!
                        const size = isTarget ? 'clamp(1.8rem, 8vw, 2.2rem)' : 'clamp(1.4rem, 6vw, 1.8rem)';
                        
                        return `<span 
                            onclick="event.stopPropagation(); app.playSound('swipe-right'); app.showCharacterOccurrences('${char}', '${themeColor}')" 
                            onpointerdown="event.stopPropagation();"
                            onmousedown="event.stopPropagation(); this.style.transform='scale(1.2)'"
                            onmouseup="this.style.transform='scale(1)'"
                            onmouseleave="this.style.transform='scale(1)'"
                            style="color: ${color}; font-weight: ${weight}; font-size: ${size}; cursor: pointer; display: inline-block; transition: transform 0.1s;"
                        >${char}</span>`;
                    }).join('');

                    html += `
                        <div class="search-result-item" style="padding-bottom: 12px; margin-bottom: 12px; border-bottom: 1px solid rgba(0,0,0,0.05);">
                            <div class="search-result-word">${highlightedWord}</div>
                            <div class="search-result-py">${py}</div>
                            <div class="search-result-en">${en}</div>
                        </div>
                    `;
                });

                // Close the wrappers
                html += `
                            </div>
                        </div>
                    </div>
                `;
                isFirst = false; // Only the first one gets auto-expanded
            }
            resultsEl.innerHTML = html;
        }

        // 4. Pop the modal open!
        modal.classList.add('active');
    }
    // ❌ Closes the modal
    closeCharSearch() {
        const modal = document.getElementById('char-search-modal');
        if (modal) modal.classList.remove('active');
       // 🚀 Unlocks the background app again
    }
    // 🧹 Clears the session (Call this when a session is finished)
    clearActiveSession() {
        localStorage.removeItem('activeStudySession');
    }
    constructor() {
        this.voices = [];
        this.selectedVoiceURI = localStorage.getItem('preferredChineseVoice') || null;
        this.initVoices(); // Start searching for voices immediately

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

        // 🚀 2. ADD THIS HERE: Tell the premium loader that setup is complete!
        if (typeof window.completeLoadingScreen === 'function') {
            window.completeLoadingScreen();
        }
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

    // 👆 END OF PASTED FUNCTIONS 👆

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
            chip.innerText = `Book ${bId}`;
            
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

        // ⏱️ 5. START TIMER HERE (Reviewing mistakes)
        this.sessionStartTime = Date.now();

        // 6. Load the mode
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
            document.getElementById('current-title').innerText = "Manage Study List";
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
        
        // ==========================================
        // ⏱️ START TIMER HERE (Nuclear Option)
        // ==========================================
        localStorage.setItem('sessionStartTime', Date.now());

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
                    <button class="remove-btn">Remove</button>
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
        // 1. END OF SESSION HANDLING
        if (!this.state.studyQueue || this.state.studyQueue.length === 0) {
            
            // Trigger confetti for the congratulation effect! (If enabled)
            // if (typeof this.triggerConfetti === 'fu   nction') this.triggerConfetti();
            
            const mc = document.getElementById('mode-current');
            const mt = document.getElementById('mode-total');
            if(mc) mc.innerText = "0";
            if(mt) mt.innerText = "0";

            if (this.state.currentMode === 'flashcards') {
                // 🏆 PREMIUM COMPLETION SCREEN
                // Hide the flashcard container completely
                const fcContainer = document.getElementById('flashcard-container');
                if (fcContainer) fcContainer.style.display = 'none'; 
                
                // Show the animated completion screen right where the flashcard was
                this.showSessionComplete(); 
                
            } else if (this.state.currentMode === 'sentences') {
                
                document.getElementById('sn-chinese').innerHTML = `
                    <div style="font-size: 3rem; margin-bottom: 10px;"></div>
                    <div style="font-size: 1.8rem; font-weight: bold;">Session Complete!</div>
                `;
                document.getElementById('sn-pinyin').innerText = "";
                
                // Inject options for sentences
                document.getElementById('sn-english').innerHTML = `
                    <p style="margin-bottom: 20px; color: var(--text-muted);">Excellent work!</p>
                    <div style="display: flex; flex-direction: column; gap: 12px; align-items: center;">
                        <button class="action-btn" onclick="app.setMode('sentences')" style="width: 100%; max-width: 220px; padding: 12px; font-size: 1rem;">Restart Sentences</button>
                        <button class="action-btn" onclick="app.startReviewMode()" style="width: 100%; max-width: 220px; padding: 12px; font-size: 1rem; background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd;">Review Unknown Words</button>
                    </div>
                `;
                document.getElementById('sn-english').classList.remove('hidden');
                const revealBtn = document.getElementById('reveal-translation-btn');
                if (revealBtn) revealBtn.style.display = 'none';
            }
            return;
        }

        // 2. NORMAL RENDERING (IF QUEUE IS NOT EMPTY)
        
        // Ensure flashcard container is visible and completion screen is hidden if restarting
        if (this.state.currentMode === 'flashcards') {
            const fcContainer = document.getElementById('flashcard-container');
            const scScreen = document.getElementById('session-complete-screen');
            
            // Bring the flashcards back
            if (fcContainer) fcContainer.style.display = 'block'; 
            
            // Hide the completion screen
            if (scScreen) {
                scScreen.classList.add('hidden');
                scScreen.style.display = 'none'; 
            }
        }

        const mc = document.getElementById('mode-current');
        if(mc) mc.innerText = this.state.currentIndex + 1;
        const mt = document.getElementById('mode-total');
        if(mt) mt.innerText = this.state.studyQueue.length;

        // 🔥 ONLY THESE LINES CHANGED AT THE BOTTOM 🔥
        if (this.state.currentMode === 'flashcards') {
            this.renderFlashcard();
            
            // Build the sentences UI after the flashcard renders
            const currentItem = this.state.studyQueue[this.state.currentIndex];
            if (currentItem && typeof this.buildSentencesUI === 'function') {
                this.buildSentencesUI(currentItem);
            }
        }
        
        if (this.state.currentMode === 'writing') this.renderWritingChar();
        if (this.state.currentMode === 'sentences') this.renderSentence();
        if (this.state.currentMode === 'quiz') this.renderQuiz();
    }  

showSessionComplete() {
        const screen = document.getElementById('session-complete-screen');
        if (!screen) return;
        
        // 1. Unhide safely
        screen.classList.remove('hidden');
        screen.style.display = 'flex'; 

        // ==========================================
        // 1. CALCULATE REAL ACCURACY & POPULATE UI
        // ==========================================
        let knownCards = parseInt(document.getElementById('stat-known-count')?.innerText || "0");
        let unknownCards = parseInt(document.getElementById('stat-study-count')?.innerText || "0");
        let totalCards = knownCards + unknownCards;

        if (totalCards === 0) {
            knownCards = this.state.score || 0;
            totalCards = this.state.history ? this.state.history.length : (this.state.currentIndex || 0);
            unknownCards = Math.max(0, totalCards - knownCards);
        }

        if (totalCards === 0) totalCards = 1; 

        let accuracy = Math.round((knownCards / totalCards) * 100);
        if (isNaN(accuracy) || accuracy < 0) accuracy = 0;

        const cardsReviewedEl = document.getElementById('sc-cards-reviewed');
        if (cardsReviewedEl) cardsReviewedEl.innerText = totalCards;
        
        const knownEl = document.getElementById('sc-known-count');
        const unknownEl = document.getElementById('sc-unknown-count');
        if (knownEl) knownEl.innerText = knownCards;
        if (unknownEl) unknownEl.innerText = unknownCards;

        // ==========================================
        // ⏱️ CALCULATE TIME SPENT
        // ==========================================
        const timeSpentEl = document.getElementById('sc-time-spent');
        if (timeSpentEl) {
            const startTime = localStorage.getItem('sessionStartTime');
            
            if (startTime) {
                const diffMs = Date.now() - parseInt(startTime);
                const totalSeconds = Math.floor(diffMs / 1000);
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;
                
                timeSpentEl.innerText = `${minutes}m ${seconds}s`;
                
                // Clear the timer so it's fresh for the next session
                localStorage.removeItem('sessionStartTime'); 
            } else {
                timeSpentEl.innerText = "0m 0s";
            }
        }

        // ==========================================
        // 2. LINE GRAPH: Dynamic Generation
        // ==========================================
        const sessionDataCorrect = [
            Math.max(0, accuracy - 15), 
            Math.max(0, accuracy - 10), 
            Math.max(0, accuracy - 5), 
            Math.max(0, accuracy - 2), 
            accuracy
        ]; 
        const sessionDataWrong = sessionDataCorrect.map(val => 100 - val); 
        
        const finalScore = accuracy;
        const previousScore = sessionDataCorrect[3];

        const graphLabel = document.getElementById('sc-graph-label');
        if (graphLabel) graphLabel.innerText = `${finalScore}%`; 

        const badge = document.getElementById('sc-improvement-badge');
        if (badge) {
            if (accuracy >= 90) {
                badge.innerText = 'Wow studios approved! ';
                badge.style.color = '#10B981'; // Green text
                badge.style.background = '#ECFDF5'; // Light green bg
            } else if (accuracy >= 70) {
                badge.innerText = 'You dont have rights to sleep';
                badge.style.color = '#3B82F6'; // Blue text
                badge.style.background = '#EFF6FF'; // Light blue bg
            } else if (accuracy >= 40) {
                badge.innerText = 'Study more bro ↓';
                badge.style.color = '#F59E0B'; // Orange text
                badge.style.background = '#FFFBEB'; // Light orange bg
            } else {
                badge.innerText = 'Bro what are you doing? ';
                badge.style.color = '#EF4444'; // Red text
                badge.style.background = '#FEF2F2'; // Light red bg
            }
        }
        
        const graphWidth = 300;
        const graphHeight = 100;

        const buildCurve = (data) => {
            const points = data.map((val, i) => ({
                x: (i / (data.length - 1)) * graphWidth,
                y: graphHeight - (val / 100) * graphHeight
            }));

            let path = `M ${points[0].x},${points[0].y} `;
            for (let i = 1; i < points.length; i++) {
                const pPrev = points[i - 1];
                const p = points[i];
                const cpX = pPrev.x + (p.x - pPrev.x) / 2;
                path += `C ${cpX},${pPrev.y} ${cpX},${p.y} ${p.x},${p.y} `;
            }
            return { path, points };
        };

        const correctCurve = buildCurve(sessionDataCorrect);
        const wrongCurve = buildCurve(sessionDataWrong);
        const areaPath = `${correctCurve.path} L ${graphWidth},${graphHeight} L 0,${graphHeight} Z`;

        const lineEl = document.getElementById('sc-graph-line'); 
        const wrongLineEl = document.getElementById('sc-graph-line-wrong'); 
        const areaEl = document.getElementById('sc-graph-area');

        if (areaEl) areaEl.setAttribute('d', areaPath);
        if (lineEl) lineEl.setAttribute('d', correctCurve.path);
        if (wrongLineEl) wrongLineEl.setAttribute('d', wrongCurve.path);

        [lineEl, wrongLineEl].forEach(el => {
            if (el) {
                const length = el.getTotalLength() + 10; 
                el.style.transition = 'none';
                el.style.strokeDasharray = `${length}px`;
                el.style.strokeDashoffset = `${length}px`; 
            }
        });
        
        if (areaEl) {
            areaEl.style.transition = 'none';
            areaEl.style.opacity = "0";
        }
        
        const lastPointEl = document.getElementById('sc-graph-last-point');
        if (lastPointEl) {
            lastPointEl.classList.add('hidden');
            lastPointEl.style.transition = 'none';
            lastPointEl.style.opacity = "0";
            const lastDot = correctCurve.points[correctCurve.points.length - 1];
            lastPointEl.style.transform = `translate(${lastDot.x}px, ${lastDot.y}px)`;
        }

        // ==========================================
        // 3. INITIALIZE PROGRESS CIRCLE (FIXED INVISIBLE STROKE)
        // ==========================================
        const circle = document.querySelector('.sc-progress-path');

        if (circle) {
            // 🔥 THE REAL BUG: style.css is trying to use a gradient URL that doesn't exist!
            // This forcefully overrides the broken CSS and makes the line beautifully green.
            circle.style.stroke = '#22c55e'; 
            
            const exactLength = circle.getTotalLength();
            
            circle.style.transition = 'none';
            circle.style.strokeDasharray = `${exactLength}px`;
            circle.style.strokeDashoffset = `${exactLength}px`; 
            
            circle.dataset.exactLength = exactLength;
        }

        document.body.offsetWidth; // Repaint

        // ==========================================
        // 4. FIRE ANIMATIONS USING requestAnimationFrame
        // ==========================================
        requestAnimationFrame(() => {
            setTimeout(() => {
                
                // A) Circular Progress Animation
                if (circle) {
                    const exactLength = parseFloat(circle.dataset.exactLength);
                    const offset = exactLength - ((accuracy / 100) * exactLength);
                    
                    circle.style.transition = 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)';
                    circle.style.strokeDashoffset = `${offset}px`; 
                }

                // B) Number Count up Animation
                const scoreEl = document.getElementById('sc-score-value');
                if (scoreEl) {
                    const duration = 1200;
                    const startTime = performance.now();
                    const animateNum = (currentTime) => {
                        const elapsed = currentTime - startTime;
                        const progressRatio = Math.min(elapsed / duration, 1);
                        const easeOut = 1 - Math.pow(1 - progressRatio, 3);
                        scoreEl.innerText = Math.floor(easeOut * accuracy);
                        if (progressRatio < 1) requestAnimationFrame(animateNum);
                        else scoreEl.innerText = accuracy;
                    };
                    requestAnimationFrame(animateNum);
                }

                // C) Draw Line Graphs Animation
                [lineEl, wrongLineEl].forEach(el => {
                    if (el) {
                        el.style.transition = 'stroke-dashoffset 2s ease-in-out';
                        el.style.strokeDashoffset = "0";
                    }
                });

                if (areaEl) {
                    areaEl.style.transition = 'opacity 1s ease-in-out 0.8s';
                    areaEl.style.opacity = "1";
                }
                
                setTimeout(() => {
                    if (lastPointEl) {
                        lastPointEl.classList.remove('hidden');
                        lastPointEl.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
                        lastPointEl.style.opacity = "1";
                    }
                }, 1600); 

            }, 50); 
        });
    }
    
    showCompletion() {


        // --- 🔄 RESUME INTERRUPTED SESSION ---
        const activeSession = localStorage.getItem('mandarinActiveSession');
        if (activeSession) {
            // Wait 0.5 seconds for the app to finish loading visually
            setTimeout(() => {
                if(confirm("Welcome back! You have an unfinished study session. Would you like to resume exactly where you left off?")) {
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
            ${mode === 'quiz' ? 'Quiz Complete!' : 'TOCL PASSED!!'}
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
        // 6. Build the Buttons (Integrated with app.startReviewMode)
        contentHTML += `
            <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                <button class="action-btn" onclick="app.state.currentIndex = 0; app.state.score = 0; app.setMode('${mode}')">
                    Restart This Session
                </button>
                <button class="action-btn" onclick="app.startReviewMode()" style="background-color: var(--primary-color); color: white;">
                    Start Reviewing Unknown Words
                </button>
                ${mode !== 'flashcards' ? `<button class="action-btn" onclick="app.setMode('flashcards')">Study Flashcards</button>` : ''}
            </div>
        `;

        msgContainer.innerHTML = contentHTML;
        
        // Step 7 has been removed because app.startReviewMode() now handles the logic directly from the button click.

        msgContainer.innerHTML = contentHTML;

        // 7. Attach the Review Logic
        document.getElementById('direct-review-btn').onclick = () => {
           this.startReviewMode();
        };

        if (typeof this.triggerConfetti === 'function') this.triggerConfetti();
    }

nextItem() {
        this.saveSession();
        this.state.currentIndex++;
        
        // When you reach the end of the deck...
        if (this.state.currentIndex >= this.state.studyQueue.length) {
            
            if (this.state.isReviewMode) {
                // In Review Mode: ONLY reload words you marked as "Study Again"
                this.state.studyQueue = [...this.state.progress.reviewQueue].sort(() => Math.random() - 0.5);
                this.state.currentIndex = 0;
            } else {
                // In Normal Mode: You finished the lesson! Empty the deck to show the "All Done!" card.
                this.state.studyQueue = [];
                this.state.currentIndex = 0;
            }
        }
        
        this.renderCurrentItem();
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
        
        // 1. Front of the card
        document.getElementById('fc-front-text').innerText = item.word || item.simplified || "?";
        
       // 🎨 --- COLOR MATCHING ENGINE (BACK OF CARD) --- 🎨
       // 1. Detect which theme the app is currently using
        const bodyClass = document.body.className || '';
        let charColors = [];

        // 2. Load the perfect colors for that specific theme!
        if (bodyClass.includes('matcha')) {
            // Earthy greens, warm oranges, and deep teals
            charColors = ['#388e3c', '#12787e', '#f57c00', '#689f38', '#d32f2f', '#00796b'];
        } else if (bodyClass.includes('sakura')) {
            // Soft pinks, purples, and blues
            charColors = ['#d81b60', '#8e24aa', '#1e88e5', '#e53935', '#3949ab', '#00897b'];
        } else if (bodyClass.includes('midnight') || bodyClass.includes('dark')) {
            // Bright neon/pastel colors that pop perfectly against dark backgrounds
            charColors = ['#ffb74d', '#64b5f6', '#81c784', '#ff8a65', '#ba68c8', '#4dd0e1']; 
        } else {
            // Default Light Theme (Classic vibrant primary colors)
            charColors = ['#04283f', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
        }
        
        const wordText = item.word || item.simplified || "";
        const pinyinText = (item.pinyin || "").trim();

        const characters = wordText.split('');
        let syllables = pinyinText.split(' ');

        // 🛠️ PINYIN AUTO-SPLITTER
        // If your pinyin has no spaces (e.g., "kělè"), this safely chops it into ["kě", "lè"]
        if (characters.length > 1 && syllables.length === 1) {
            const vowels = "aeiouüvāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü";
            // Matches valid Pinyin phonetic blocks
            const pinyinRegex = new RegExp(`[bcdfghjklmnpqrstwxyz]*[${vowels}]+(?:ng|n|r)?`, 'gi');
            const matches = pinyinText.match(pinyinRegex);
            
            // If it chopped it perfectly, use it!
            if (matches && matches.length === characters.length) {
                syllables = matches;
            }
        }

        let wordHTML = '';
        let pinyinHTML = '';

        for (let i = 0; i < characters.length; i++) {
            const color = charColors[i % charColors.length];
            
            // 🖌️ Force TWKai Font, smaller size, and perfect colors
         // 🖌️ Added mousedown/pointerdown stopPropagation to fix Laptop clicking!
wordHTML += `<span onclick="event.stopPropagation(); app.playSound('swipe-right'); app.showCharacterOccurrences('${characters[i]}', '${color}')" onpointerdown="event.stopPropagation();" onmousedown="event.stopPropagation(); this.style.transform='scale(1.1)'" onmouseup="this.style.transform='scale(1)'" onmouseleave="this.style.transform='scale(1)'" style="cursor: pointer; color: ${color} !important; font-family: 'TWKai', 'LXGW WenKai TC', serif !important; font-size: clamp(2.15rem, 8.5vw, 3.2rem) !important; margin: 0 2px; transition: transform 0.1s; display: inline-block;">${characters[i]}</span>`;
            
            // Match Pinyin perfectly underneath
            if (syllables[i]) {
                pinyinHTML += `<span style="color: ${color}; margin: 0 4px;">${syllables[i]}</span>`;
            }
        }

const backWordEl = document.getElementById('fc-back-word');
        if(backWordEl) {
            backWordEl.innerHTML = wordHTML;
            backWordEl.style.marginBottom = "5px"; 
            backWordEl.style.lineHeight = "1.2";
        }
        document.getElementById('fc-pinyin').innerHTML = pinyinHTML;
        // 🎨 --- END COLOR ENGINE --- 🎨
        
        // Rest of the back of the card
        document.getElementById('fc-meaning').innerText = item.definition || item.meaning || item.english || "";
        
        // 👇 PASTE THE NEW GRAMMAR CODE RIGHT HERE 👇
        const posElement = document.getElementById('fc-part-of-speech');
        if (posElement && item.type) {
            // Map the textbook's short codes to full English words
            const typeMap = {
                'N': 'Noun',
                'V': 'Verb',
                'Vs': 'Stative Verb (Adjective)',
                'Vpt': 'Action Verb',
                'Adv': 'Adverb',
                'Conj': 'Conjunction',
                'Prep': 'Preposition',
                'M': 'Measure Word',
                'Ptc': 'Particle',
                'Pron': 'Pronoun',
                'Num': 'Number',
                'Det': 'Determiner',
                'Vi': 'Intransitive Verb',
                'Vt': 'Transitive Verb'
            };

            // Look up the full name. If it's a weird code not in the list, just show the code itself.
            const fullType = typeMap[item.type.trim()] || item.type.trim();
            
            // Display it beautifully on the card
            posElement.textContent = `— ${fullType} —`;
            posElement.style.display = 'block';
        } else if (posElement) {
            // Hide it if the word has no grammar type listed
            posElement.style.display = 'none';
        }
        // 🚨 ADD THIS LINE BELOW TO BRING BACK THE SENTENCES 🚨
        this.buildSentencesUI(item);
        // 👆 NEW CODE ENDS HERE 👆
        
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
                exBox.innerHTML = `<strong>Example:</strong><br>${found.sentence}<br><span style="color:var(--text-muted); font-size: 0.9em;">${found.english}</span>`;
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

    // --- THE BULLETPROOF SWIPE ENGINE ---
    handleSwipe(direction) {
        // 🛡️ THE LOCK: Ignore swipes if a card is already flying off the screen!
        if (this.state.isAnimating) return;
        this.state.isAnimating = true;

        const activeCard = document.getElementById('flashcard');
        const currentItem = this.state.studyQueue[this.state.currentIndex];
        
        if (!currentItem) {
            this.state.isAnimating = false;
            return;
        }

        const getItemKey = item => item.id || item.word || item.simplified || JSON.stringify(item);
        const currentKey = getItemKey(currentItem);

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
            activeCard.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease';
            activeCard.style.opacity = '0';
            activeCard.style.transform = `translateX(${direction === 'left' ? '-150%' : '150%'}) rotate(${direction === 'left' ? '-20deg' : '20deg'})`;
        }

        setTimeout(() => {
            this.nextItem();
            // 🔓 UNLOCK: Allow the user to swipe the next card now
            this.state.isAnimating = false; 
        }, 300);
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
            btn.innerText = "Stop Slideshow";
            btn.classList.add('active');
            this.runSlideshowStep();
        } else {
            btn.innerText = " Slideshow";
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
            width: 350, 
            height: 350, 
            padding: 30,       // 🚨 Best padding for Traditional strokes
            drawingWidth: 40,  // 🚨 FIXED: 40 strictly prevents the "2 lines" ghosting
            strokeWidth: 2,    // Thinner outline
            strokeColor: isDark ? '#E8E6E1' : '#000000',
            radicalColor: isDark ? '#5EBBBA' : '#007bff', 
            showOutline: !this.state.outlineHidden,
            outlineColor: isDark ? '#334155' : '#e0e0e0',

            // 🇹🇼 STRICT TAIWAN MOE STROKE DATA 
            charDataLoader: (char, onComplete) => {
                fetch(`https://cdn.jsdelivr.net/npm/hanzi-writer-data-tw@0.1/${char}.json`)
                    .then(res => res.json())
                    .then(onComplete)
                    .catch(() => {
                        console.warn("Taiwan stroke data not found, falling back...");
                        // If TW data fails to load for a rare character, fallback safely
                        fetch(`https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/${char}.json`)
                            .then(res => res.json())
                            .then(onComplete);
                    });
            }
        });
        
        document.getElementById('toggle-outline-btn').innerText = this.state.outlineHidden ? "Show Outline" : "Hide Outline";
        this.resetWriting(); // Bind the quiz properly
    }

   toggleOutline() {
        if (!this.hanziWriter) return;
        this.state.outlineHidden = !this.state.outlineHidden;
        const btn = document.getElementById('toggle-outline-btn');
        
        if (this.state.outlineHidden) { 
            this.hanziWriter.hideOutline(); 
            if(btn) btn.innerText = "Show Outline"; 
        } else { 
            this.hanziWriter.showOutline(); 
            if(btn) btn.innerText = "Hide Outline"; 
        }
    }

    animateCharacter() {
        if (!this.hanziWriter) return;
        this.hanziWriter.cancelQuiz(); // 🚨 FIX: Cancels practice before drawing
        this.hanziWriter.animateCharacter({
            onComplete: () => {
                setTimeout(() => this.resetWriting(), 1000); // Restart practice after animation
            }
        });
    }

    resetWriting() {
        if (!this.hanziWriter) return;
        this.hanziWriter.quiz({
            onComplete: () => {
                // 🚨 FIX: Reward the user when they successfully trace it!
                this.playSound('correct');
                if (typeof this.triggerConfetti === 'function') {
                    this.triggerConfetti();
                }
            }
        }); 
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
            btn.innerText = "Stop Slideshow"; btn.classList.add('active');
            this.runSentenceSlideshowStep();
        } else {
            btn.innerText = "Start Slideshow"; btn.classList.remove('active');
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
        if (!this.state.studyQueue || this.state.studyQueue.length === 0) return; 
        
        const sessionData = {
            queue: this.state.studyQueue,
            index: this.state.currentIndex,
            mode: this.state.currentMode,
            score: this.state.score,
            history: this.state.history || []
        };
        
        localStorage.setItem('mandarinActiveSession', JSON.stringify(sessionData));
    }

   renderQuiz() {
        var item = this.state.studyQueue[this.state.currentIndex];
        if (!item) return;

        var qType = document.getElementById('qz-q-type') ? document.getElementById('qz-q-type').value : 'zh';
        var aType = document.getElementById('qz-a-type') ? document.getElementById('qz-a-type').value : 'mc';
        
        var scoreUi = document.getElementById('quiz-score-ui');
        if (scoreUi) scoreUi.innerText = `Score: ${this.state.score || 0} / ${this.state.studyQueue.length}`;

        var questionText = qType === 'zh' ? (item.word || item.simplified) : (qType === 'py' ? item.pinyin : (item.definition || item.english));
        var correctMeaning = qType === 'zh' ? ((aType === 'mc-py') ? item.pinyin : (item.definition || item.english)) : (item.word || item.simplified);
        
        var topWord = document.getElementById('qz-word');
        if (topWord) {
            topWord.innerText = questionText;
            // 🚀 DYNAMIC FONT: TWKai for Chinese, Quicksand for English/Pinyin
            if (qType === 'zh') {
                topWord.style.setProperty('font-family', "'TWKai', 'LXGW WenKai TC', 'KaiTi', serif", 'important');
                topWord.style.setProperty('font-weight', "400", 'important');
            } else {
                topWord.style.setProperty('font-family', "'Quicksand', sans-serif", 'important');
                topWord.style.setProperty('font-weight', "700", 'important');
            }
        }

        var hintEl = document.getElementById('qz-pinyin-hint');
        var pinyinBtn = document.getElementById('qz-pinyin-btn');
        if (hintEl) {
            hintEl.classList.add('hidden'); 
            hintEl.innerText = item.pinyin || ""; 
            // 🚀 FORCE PINYIN TO USE QUICKSAND FONT
            hintEl.style.setProperty('font-family', "'Quicksand', sans-serif", 'important');
            hintEl.style.setProperty('font-weight', "600", 'important');
            
            if (pinyinBtn) {
                pinyinBtn.style.display = (qType === 'zh') ? 'inline-block' : 'none';
            }
        }
        
        var soundBtn = document.getElementById('qz-sound-btn');
        if (soundBtn) {
            soundBtn.onclick = (e) => {
                e.stopPropagation();
                this.playAudio(item.word || item.simplified, 'zh-CN');
            };
        }
        
        if (this.state.autoAudio) this.playAudio(item.word || item.simplified, 'zh-CN');
        
        var optionsContainer = document.getElementById('qz-options');
        if(optionsContainer) optionsContainer.innerHTML = ''; 

        // --- THE "TYPE ANSWER" MODE ---
       // --- THE "TYPE ANSWER" MODE ---
        if (aType === 'type' && optionsContainer) {
            optionsContainer.style.display = 'flex'; 
            optionsContainer.style.flexDirection = 'column';
            optionsContainer.style.alignItems = 'center';
            optionsContainer.style.width = '100%';
            
            const inputField = document.createElement('input');
            inputField.type = 'text';
            inputField.placeholder = "Type your answer...";
            
            // 🚀 Perfectly centered input box for mobile
            inputField.style.cssText = `
                width: 100%; 
                box-sizing: border-box;
                padding: 15px; 
                font-size: 1.2rem; 
                border-radius: 12px; 
                border: 2px solid var(--border-color); 
                text-align: center; 
                outline: none; 
                transition: all 0.3s;
                background: var(--card-bg);
                color: var(--text-main);
                margin-top: 15px;
            `;

            // 🚀 The new Mobile-Friendly Submit / Next Button
            const submitBtn = document.createElement('button');
            submitBtn.innerText = "Submit Answer";
            submitBtn.style.cssText = `
                width: 100%;
                box-sizing: border-box;
                padding: 15px;
                font-size: 1.2rem;
                font-weight: bold;
                border-radius: 12px;
                border: none;
                background: var(--primary-color);
                color: white;
                margin-top: 15px;
                box-shadow: var(--shadow-sm);
            `;

            optionsContainer.appendChild(inputField);
            optionsContainer.appendChild(submitBtn);
            setTimeout(() => inputField.focus(), 100); 

            // 🧠 The universal grading function (works for both Enter key AND Button click)
            const processAnswer = () => {
                // If already wrong/graded, pressing the button again moves to next question!
                if (inputField.readOnly) {
                    this.nextItem();
                    return;
                }

                let userAnswer = inputField.value.trim().toLowerCase();
                let isCorrect = false;

                const typeZhTarget = document.getElementById('type-zh-target') ? document.getElementById('type-zh-target').value : 'english';
                const typeEnTarget = document.getElementById('type-en-target') ? document.getElementById('type-en-target').value : 'char';

                const normalizePinyin = (str) => {
                    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/gi, "").toLowerCase();
                };

                if (qType === 'en') {
                    if (typeEnTarget === 'pinyin') {
                        const correctPinyin = normalizePinyin(item.pinyin || '');
                        let cleanedUser = normalizePinyin(userAnswer);
                        isCorrect = (cleanedUser === correctPinyin);
                    } else { 
                        const correctChar = item.word || item.simplified || '';
                        isCorrect = (userAnswer === correctChar);
                    }
                } 
                else { 
                    if (typeZhTarget === 'pinyin') {
                        const correctPinyin = normalizePinyin(item.pinyin || '');
                        let cleanedUser = normalizePinyin(userAnswer);
                        isCorrect = (cleanedUser === correctPinyin);
                    } else { 
                        let correctFull = (item.definition || item.english || correctMeaning).toLowerCase();
                        let cleanedCorrect = correctFull.replace(/\([^)]*\)/g, '').trim();
                        const userWords = userAnswer.split(/\s+/);
                        const correctWords = cleanedCorrect.split(/[\s,;/.!?'"-]+/);
                        
                        isCorrect = userWords.some(w => w.length > 1 && correctWords.includes(w)) || 
                                    (cleanedCorrect.includes(userAnswer) && userAnswer.length > 2);
                    }
                }

                if (isCorrect && userAnswer !== "") {
                    // CORRECT
                    this.playSound('correct'); 
                    inputField.style.borderColor = '#28a745'; 
                    inputField.style.backgroundColor = '#d4edda';
                    inputField.style.color = '#155724';
                    this.state.score++;
                    inputField.disabled = true; 
                    submitBtn.style.display = 'none'; // Hide button, it's auto-advancing
                    
                    let delaySpeed = document.getElementById('qz-delay-speed') ? document.getElementById('qz-delay-speed').value : 'normal';
                    let correctDelay = delaySpeed === 'instant' ? 300 : (delaySpeed === 'fast' ? 750 : 1500);
                    setTimeout(() => this.nextItem(), correctDelay);

                } else {
                    // WRONG
                    this.playSound('wrong'); 
                    inputField.style.borderColor = '#dc3545';
                    inputField.style.backgroundColor = '#f8d7da';
                    inputField.style.color = '#721c24';
                    inputField.readOnly = true; 
                    
                    // Change the button to be a "Next" button
                    submitBtn.innerText = "Next Question ➔";
                    submitBtn.style.background = "#334155"; 
                    
                    // 🚀 DISPLAY FULL ANSWER IN THE TOP QUESTION BOX
                    const correctChar = item.word || item.simplified || '';
                    const pinyin = item.pinyin || '';
                    const meaning = item.definition || item.english || correctMeaning;
                    
                    const topBox = document.getElementById('qz-word');
                    if (topBox) {
                        topBox.innerHTML = `
                            <div style="font-size: 0.35em; color: #dc3545; margin-bottom: 10px; font-family: 'Quicksand', sans-serif; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Incorrect</div>
                            <div style="color: var(--primary-color); line-height: 1.1;">${correctChar}</div>
                            <div style="font-size: 0.5em; color: var(--text-muted); margin-top: 10px; font-family: 'Quicksand', sans-serif; font-weight: 500;">${pinyin}</div>
                            <div style="font-size: 0.4em; color: var(--text-main); margin-top: 5px; font-family: 'Quicksand', sans-serif; font-weight: 600; white-space: normal;">${meaning}</div>
                        `;
                    }

                    // Hide the separate pinyin hint since we just put it in the main box
                    if (hintEl) hintEl.classList.add('hidden');
                }
            };

            // Allow BOTH the Enter Key and the Submit Button to trigger the check
            inputField.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault(); 
                    processAnswer();
                }
            });
            
            submitBtn.onclick = (e) => {
                e.preventDefault();
                processAnswer();
            };

        // --- NORMAL MULTIPLE CHOICE MODE ---

        // --- NORMAL MULTIPLE CHOICE MODE ---
            } else if (optionsContainer) {
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
                    
                    // 🚀 SMART FONT ASSIGNMENT FOR THE BUTTONS
                    if (aType === 'mc-py') {
                        btn.innerText = opt.pinyin;
                        btn.style.setProperty('font-family', "'Quicksand', sans-serif", 'important');
                        btn.style.setProperty('font-weight', "600", 'important');
                    }
                    else if (qType === 'en') {
                        btn.innerText = opt.word || opt.simplified;
                        // Answer is Chinese characters
                        btn.style.setProperty('font-family', "'TWKai', 'LXGW WenKai TC', 'KaiTi', serif", 'important');
                        btn.style.setProperty('font-weight', "400", 'important');
                    }
                    else {
                        btn.innerText = opt.definition || opt.meaning || opt.english;
                        btn.style.setProperty('font-family', "'Quicksand', sans-serif", 'important');
                        btn.style.setProperty('font-weight', "600", 'important');
                    }

                    btn.dataset.isCorrect = ((opt.id || opt.word) === (item.id || item.word)) ? 'true' : 'false';

                    btn.onpointerdown = (e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        Array.from(optionsContainer.children).forEach(child => child.disabled = true);

                        let delaySpeed = document.getElementById('qz-delay-speed') ? document.getElementById('qz-delay-speed').value : 'normal';

                        if (btn.dataset.isCorrect === 'true') {
                            this.playSound('correct');
                            btn.style.backgroundColor = '#d4edda';
                            this.state.score++;
                            
                            let correctDelay = delaySpeed === 'instant' ? 300 : (delaySpeed === 'fast' ? 750 : 1500);
                            setTimeout(() => this.nextItem(), correctDelay);
                        } else {
                            this.playSound('wrong');
                            btn.style.backgroundColor = '#f8d7da'; 
                            
                            const correctBtn = Array.from(optionsContainer.children).find(c => c.dataset.isCorrect === 'true');
                            if (correctBtn) {
                                correctBtn.style.backgroundColor = '#d4edda'; 
                                correctBtn.style.border = '2px solid #28a745';
                                
                                const char = item.word || item.simplified || '';
                                const py = item.pinyin || '';
                                const mn = item.definition || item.english || '';
                                
                                correctBtn.innerHTML = `
                                    <div style="font-family:'TWKai', serif; font-weight:400; font-size:1.4em; margin-bottom:4px; color:#155724;">${char}</div>
                                    <div style="font-family:'Quicksand', sans-serif; font-weight:600; font-size:1em; color:#155724;">${py}</div>
                                    <div style="font-family:'Quicksand', sans-serif; font-weight:600; font-size:0.95em; margin-top:4px; color:#155724; line-height:1.2; white-space:normal;">${mn}</div>
                                `;
                            }

                            if (hintEl && qType === 'zh') hintEl.classList.remove('hidden');

                            let wrongDelay = delaySpeed === 'instant' ? 1200 : (delaySpeed === 'fast' ? 2000 : 3500);
                            setTimeout(() => this.nextItem(), wrongDelay);
                        }
                    };
                    optionsContainer.appendChild(btn);
                });
            }
    }

    // --- 3. DYNAMIC COMPLETION SCREEN & SUGGESTIONS ---
    showCompletion() {
        // 1. Hide screens and handle resume (keeping your existing logic)
        document.querySelectorAll('.study-view').forEach(v => v.classList.remove('active'));
        const activeSession = localStorage.getItem('mandarinActiveSession');
        if (activeSession) {
            setTimeout(() => {
                if(confirm("Resume session?")) {
                    const parsed = JSON.parse(activeSession);
                    this.state.studyQueue = parsed.queue;
                    this.state.currentIndex = parsed.index;
                    this.setMode(parsed.mode);
                } else {
                    localStorage.removeItem('mandarinActiveSession');
                }
            }, 500);
        }

        let completeView = document.getElementById('view-complete');
        if (!completeView) return; // Ensure view exists
        completeView.classList.add('active');

        let msgContainer = completeView.querySelector('.completion-message');
        const mode = this.state.currentMode;

        // 2. Build the UI WITHOUT 'onclick' attributes
        msgContainer.innerHTML = `
            <h1 style="font-size: 2.5rem;">Session Complete!</h1>
            <p style="margin-bottom: 30px;">Excellent work reviewing this set.</p>
            <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                <button class="action-btn" id="btn-restart-session">Restart Session</button>
                <button class="action-btn" id="btn-direct-review" style="background-color: var(--primary-color); color: white;">Review Unknown</button>
                <button class="action-btn" id="btn-go-flashcards">Study Flashcards</button>
            </div>
        `;
        // 3. Attach listeners via JavaScript (Safe from CSP)
        document.getElementById('btn-restart-session').addEventListener('click', () => {
            this.state.currentIndex = 0;
            this.state.score = 0;
            this.setMode(mode);
        });

        document.getElementById('btn-direct-review').addEventListener('click', () => {
            this.startReviewMode();
        });

        const flashcardBtn = document.getElementById('btn-go-flashcards');
        if (flashcardBtn) {
            flashcardBtn.addEventListener('click', () => this.setMode('flashcards'));
        }

        if (typeof this.triggerConfetti === 'function') this.triggerConfetti();
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
            
            // 🔒 THE LOCK: Ignore keys if a card is currently flying off screen
            if (this.state.isAnimating) return; 

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
        
        // We clone the card to remove any old, leftover event listeners
        const newCard = card.cloneNode(true);
        card.parentNode.replaceChild(newCard, card);
        const activeCard = document.getElementById('flashcard');

        // --- MOBILE TOUCH FIX ---
        activeCard.style.touchAction = 'pan-y';

        // 👈 1. SET UP THE TRACKING VARIABLES HERE (Only declared ONCE!)
        let startX = 0;
        let startY = 0; 
        let startTime = 0;
        let isVerticalScroll = false;
        let hasBrokenDeadzone = false;

    activeCard.addEventListener('pointerdown', (e) => {
            if(e.target.tagName.toLowerCase() === 'button') return; 
            
            // 🛑 THE NEW FIX: If they tap the scroll hints, ignore the swipe/flip logic entirely!
            if (e.target.classList.contains('scroll-down-hint') || e.target.classList.contains('scroll-up-hint')) return;

            // Ignore right-clicks to prevent bugs on desktop
            if (e.pointerType === 'mouse' && e.button !== 0) return; 
            
            // 🔒 THE LOCK: Prevent grabbing the card if it's already swiping away
            if (this.state.isAnimating) return; 

            this.swipeState.isDragging = true;
            startX = e.clientX; 
            startY = e.clientY; 
            startTime = Date.now();
            isVerticalScroll = false; 
            hasBrokenDeadzone = false; 

            activeCard.style.transition = 'none';
            
            // 🗑️ WE COMPLETELY DELETED THE `setPointerCapture` LINE HERE!
        });

        // 🚫 2. MOBILE SAFARI FIX
        activeCard.addEventListener('touchmove', (e) => {
            if (this.swipeState.isDragging && hasBrokenDeadzone && !isVerticalScroll) { 
                e.preventDefault(); 
            }
        }, { passive: false });

        // 🚀 3. THE SMART POINTERMOVE
        activeCard.addEventListener('pointermove', (e) => {
            if (!this.swipeState.isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = Math.abs(e.clientY - startY);
            
            // 🛑 THE DEADZONE: Wait until the finger moves at least 15 pixels
            if (!hasBrokenDeadzone) {
                if (Math.abs(deltaX) > 15 || deltaY > 15) {
                    hasBrokenDeadzone = true; 
                    if (deltaY > Math.abs(deltaX)) {
                        isVerticalScroll = true; 
                    }
                } else {
                    return; 
                }
            }

            // 🛑 THE AXIS LOCK: If locked into a vertical scroll, ABORT the flashcard swipe!
            if (isVerticalScroll) {
                this.swipeState.isDragging = false; 
                activeCard.style.transform = 'translateX(0px) rotate(0deg)'; 
                return; 
            }

            // --- YOUR NORMAL HORIZONTAL SWIPING LOGIC CONTINUES BELOW ---
            activeCard.style.transform = `translateX(${deltaX}px) rotate(${deltaX * 0.05}deg)`; 
            
            const ratio = Math.min(Math.abs(deltaX) / (window.innerWidth / 2), 1);
            
            const knownBtn = document.getElementById('btn-known');
            const studyBtn = document.getElementById('btn-study');
            
            if (deltaX > 20) {
                activeCard.style.boxShadow = `10px 0 20px rgba(76, 175, 80, ${ratio * 0.5})`;
                if(knownBtn) knownBtn.style.transform = `scale(${1 + ratio * 0.2})`;
            } else if (deltaX < -20) {
                activeCard.style.boxShadow = `-10px 0 20px rgba(244, 67, 54, ${ratio * 0.5})`;
                if(studyBtn) studyBtn.style.transform = `scale(${1 + ratio * 0.2})`;
            }
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

        // 🚀 3. Find the best Mandarin voice (User Selected OR Fallback)
        if (this.selectedVoiceURI && this.voices && this.voices.length > 0) {
            // Use the exact voice the user picked from the dropdown!
            const chosenVoice = this.voices.find(v => v.voiceURI === this.selectedVoiceURI);
            if (chosenVoice) {
                utterance.voice = chosenVoice;
            } else {
                utterance.lang = 'zh-TW'; // Fallback just in case
            }
        } else {
            // Keep your awesome fallback logic if the dropdown hasn't loaded yet
            const voices = window.speechSynthesis.getVoices();
            let zhVoice = voices.find(v => v.lang === 'zh-TW' || v.lang === 'zh_TW');
            if (!zhVoice) zhVoice = voices.find(v => v.lang.includes('zh'));
            
            if (zhVoice) {
                utterance.voice = zhVoice;
            } else {
                utterance.lang = 'zh-TW'; 
            }
        }

        // 4. Speak!
        window.speechSynthesis.speak(utterance);
    }

    // 🎤 Scans the device for Chinese voices and fills the dropdown
    initVoices() {
        this.voices = [];
        this.selectedVoiceURI = localStorage.getItem('preferredChineseVoice') || null;

        const loadAvailableVoices = () => {
            this.voices = window.speechSynthesis.getVoices();
            const selector = document.getElementById('voice-selector');
            if (!selector) return;

            // Catch all Chinese variants (zh-TW, zh-CN, cmn, yue)
            const zhVoices = this.voices.filter(v => 
                v.lang.toLowerCase().includes('zh') || 
                v.lang.toLowerCase().includes('cmn') || 
                v.lang.toLowerCase().includes('yue')
            );

            // 🚀 THE FIX: If it hasn't loaded them yet, try again in 300 milliseconds!
            if (this.voices.length === 0) {
                setTimeout(loadAvailableVoices, 300);
                selector.innerHTML = '<option value="">Loading voices...</option>';
                return;
            }

            // If it loaded voices, but NO Chinese voices exist on this device:
            if (zhVoices.length === 0) {
                selector.innerHTML = '<option value="">System Default</option>';
                return;
            }

            selector.innerHTML = ''; // Clear "Loading..."
            
            zhVoices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.voiceURI;
                
                let cleanName = voice.name.replace(/Microsoft|Google|Apple|Network/ig, '').trim();
                if (cleanName === "") cleanName = "Standard Voice";
                
                let region = '🇨🇳'; // Default to mainland flag
                if (voice.lang.toUpperCase().includes('TW')) region = '🇹🇼';
                if (voice.lang.toUpperCase().includes('HK')) region = '🇭🇰';
                
                option.textContent = `${region} ${cleanName}`;
                
                if (this.selectedVoiceURI === voice.voiceURI) option.selected = true;
                selector.appendChild(option);
            });

            if (!this.selectedVoiceURI && zhVoices.length > 0) {
                this.selectedVoiceURI = zhVoices[0].voiceURI;
            }
        };

        loadAvailableVoices(); // Run it immediately
        
        // Also listen for the browser telling us it finally found the voices
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = loadAvailableVoices;
        }
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
// --- TYPE ANSWER SETTINGS DROPDOWN LISTENER ---
document.addEventListener('DOMContentLoaded', () => {
    const answerTypeSelect = document.getElementById('qz-answer-type');
    const typeSettingsBox = document.getElementById('type-answer-settings');
    
    if (answerTypeSelect && typeSettingsBox) {
        // Check initial state in case it's already selected
        if (answerTypeSelect.value === 'type') {
            typeSettingsBox.classList.remove('hidden');
        }

        // Listen for changes
        answerTypeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'type') {
                typeSettingsBox.classList.remove('hidden');
            } else {
                typeSettingsBox.classList.add('hidden');
            }
        });
    }
});

// --- CLOSE FLOATING MENUS WHEN CLICKING THE BACKGROUND ---
document.addEventListener('click', (event) => {
    
    // 1. Put the HTML IDs of all your floating menus/boxes here:
    const floatingMenus = [
        document.getElementById('type-answer-settings'),
        // 🛑 Replace these with your actual IDs for your books/lessons/study mode boxes!
        document.getElementById('your-books-menu-id'),     
        document.getElementById('your-lessons-menu-id'),   
        document.getElementById('your-study-mode-menu-id') 
    ];

    // 2. Put the HTML IDs of the buttons/selects that OPEN those menus here:
    // (We need this so clicking the button to open it doesn't immediately close it)
    const toggleButtons = [
        document.getElementById('qz-a-type'),
        // 🛑 Replace these with the actual IDs of the buttons you click to open the menus!
        document.getElementById('your-books-button-id'),
        document.getElementById('your-lessons-button-id'),
        document.getElementById('your-study-mode-button-id')
    ];

    // 3. Check if the user clicked INSIDE one of the menus or ON one of the buttons
    let clickedInsideMenu = floatingMenus.some(menu => menu && menu.contains(event.target));
    let clickedToggleButton = toggleButtons.some(btn => btn && btn.contains(event.target));

    // 4. If they clicked the background (outside the menus and buttons), hide them!
    if (!clickedInsideMenu && !clickedToggleButton) {
        floatingMenus.forEach(menu => {
            // If the menu exists and is currently visible, hide it
            if (menu && !menu.classList.contains('hidden')) {
                menu.classList.add('hidden'); 
                // Note: If you use something other than '.hidden' to hide things 
                // (like menu.style.display = 'none'), change this line to match!
            }
        });
    }
});

// =====================================================================
// 🚀 CLEAN BACKGROUND CLICK LISTENER (FIXED)
// =====================================================================
// =====================================================================
// GLOBAL CLICK LISTENER (FIXED)
// =====================================================================
document.addEventListener('click', (event) => {
    const path = event.composedPath ? event.composedPath() : [];

    // 1. Close Native <details> Menus (Settings, Books, Mode, Review)
    document.querySelectorAll('details[open]').forEach(details => {
        const clickedInside = path.includes(details) || details.contains(event.target);
        if (!clickedInside) {
            details.removeAttribute('open');
        }
    });

    // 2. Close Custom Floating Dropdowns (Flashcard/Sentence Settings)
    document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
        const dropdownParent = menu.closest('.dropdown');
        const clickedInside = dropdownParent && (path.includes(dropdownParent) || dropdownParent.contains(event.target));
        if (dropdownParent && !clickedInside) {
            menu.classList.remove('show');
        }
    });

    // --- 🚀 3. TAP TO SCROLL LOGIC ---
    if (event.target.classList.contains('scroll-down-hint')) {
        const cardBack = event.target.closest('.card-back');
        if (cardBack) {
            // Smoothly slide down to the examples
            cardBack.scrollTo({ top: cardBack.scrollHeight, behavior: 'smooth' });
        }
    }

    if (event.target.classList.contains('scroll-up-hint')) {
        const cardBack = event.target.closest('.card-back');
        if (cardBack) {
            // Smoothly slide back to the top
            cardBack.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
}); // <-- End of the global click listener


// ==========================================================================
// 🚀 SMART AUTO-RESIZE: CHINESE SENTENCES BASED ON LENGTH
// ==========================================================================
const sentenceSizer = new MutationObserver(() => {
    document.querySelectorAll('.fc-ex-zh').forEach(zhBox => {
        // Prevent running multiple times on the same sentence
        if (zhBox.dataset.resized) return; 

        // Count how many characters are in the sentence
        const charCount = zhBox.innerText.trim().length;

        if (charCount <= 6) {
            // 🚀 VERY SHORT (1-6 chars): Make it absolutely massive!
            zhBox.style.setProperty('font-size', 'clamp(3rem, 13vw, 5rem)', 'important');
            zhBox.style.setProperty('line-height', '1.2', 'important');
        } 
        else if (charCount <= 12) {
            // 🚀 MEDIUM (7-12 chars): Still very large, but safe for wrapping
            zhBox.style.setProperty('font-size', 'clamp(2.2rem, 9vw, 3.5rem)', 'important');
            zhBox.style.setProperty('line-height', '1.3', 'important');
        } 
        else if (charCount <= 20) {
            // 🚀 LONG (13-20 chars): Shrink it down so it fits gracefully
            zhBox.style.setProperty('font-size', 'clamp(1.6rem, 7vw, 2.4rem)', 'important');
            zhBox.style.setProperty('line-height', '1.4', 'important');
        } 
        else {
            // 🚀 VERY LONG (21+ chars): Shrink to standard size to prevent breaking the card
            zhBox.style.setProperty('font-size', 'clamp(1.3rem, 5vw, 1.8rem)', 'important');
            zhBox.style.setProperty('line-height', '1.5', 'important');
        }
        
        // Mark as resized so we don't calculate it again
        zhBox.dataset.resized = "true";
    });
});

// Start watching the app for flashcard flips
sentenceSizer.observe(document.body, { childList: true, subtree: true });

// ==========================================================================
// 🚀 SMART AUTO-RESIZE v3: SAFE & CRASH-FREE
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    const sentenceSizer = new MutationObserver((mutations) => {
        // Only look for example boxes that haven't been resized yet
        const zhBoxes = document.querySelectorAll('.fc-ex-zh:not([data-resized="true"])');
        
        zhBoxes.forEach(zhBox => {
            // Strip out punctuation/English to get the TRUE Chinese character count
            const textStr = zhBox.textContent.replace(/[^\u4e00-\u9fa5]/g, '');
            const charCount = textStr.length;
            
            if (charCount === 0) return;

            // Grab the Pinyin and English boxes
            const parent = zhBox.closest('.fc-examples') || zhBox.parentElement;
            const pyBox = parent ? parent.querySelector('.fc-ex-py') : null;
            const enBox = parent ? parent.querySelector('.fc-ex-en') : null;

            if (charCount <= 8) {
                // 🚀 SUPER SHORT (1-8 chars)
                zhBox.style.setProperty('font-size', 'min(14vw, 4.5rem)', 'important');
                zhBox.style.setProperty('line-height', '1.3', 'important');
                if(pyBox) pyBox.style.setProperty('font-size', 'min(6.5vw, 2rem)', 'important');
                if(enBox) enBox.style.setProperty('font-size', 'min(5.5vw, 1.8rem)', 'important');
            } 
            else if (charCount <= 16) {
                // 🚀 MEDIUM (9-16 chars)
                zhBox.style.setProperty('font-size', 'min(10vw, 3.5rem)', 'important');
                zhBox.style.setProperty('line-height', '1.35', 'important');
                if(pyBox) pyBox.style.setProperty('font-size', 'min(5.5vw, 1.8rem)', 'important');
                if(enBox) enBox.style.setProperty('font-size', 'min(5vw, 1.6rem)', 'important');
            } 
            else {
                // 🚀 LONG (17+ chars)
                zhBox.style.setProperty('font-size', 'min(8vw, 2.5rem)', 'important');
                zhBox.style.setProperty('line-height', '1.4', 'important');
                if(pyBox) pyBox.style.setProperty('font-size', 'min(5vw, 1.5rem)', 'important');
                if(enBox) enBox.style.setProperty('font-size', 'min(4.5vw, 1.4rem)', 'important');
            }
            
            // Mark as resized so it NEVER runs on this box again and causes lag
            zhBox.setAttribute('data-resized', 'true');
        });
    });

    // ONLY watch for new flashcards being rendered. DO NOT watch attributes.
    sentenceSizer.observe(document.body, { childList: true, subtree: true });
});

// ==========================================================================
// 🚀 SMART AUTO-RESIZE: FRONT FLASHCARD (ONE-LINE STRICT)
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    const cardSizer = new MutationObserver(() => {
        const targetBoxes = document.querySelectorAll('#fc-front-text, #fc-back-word');
        
        targetBoxes.forEach(box => {
            const text = box.innerText;
            if (box.dataset.frontResized === text) return; 

            // 🛑 1. CLONE & CLEAN: Mathematically remove the sentences so they don't ruin the character count!
            const clone = box.cloneNode(true);
            const sentencesContainer = clone.querySelector('#fc-sentences-container');
            const extraInfoBox = clone.querySelector('.card-extra-info');
            if (sentencesContainer) sentencesContainer.remove();
            if (extraInfoBox) extraInfoBox.remove();
            
            // Only count the characters of the actual main word
            const cleanText = clone.innerText; 
            const rawText = cleanText.replace(/[\s\p{P}]/gu, '');
            const charCount = rawText.length;
            
            if (charCount === 0) return;

            // 🚨 0. BULLETPROOF CHINESE DETECTOR 🚨
            const hasChinese = /[\u4e00-\u9fa5]/.test(cleanText);

            if (!hasChinese) {
                box.style.removeProperty('font-size');
                box.style.removeProperty('line-height');
                box.style.removeProperty('white-space');
                box.style.removeProperty('word-break');
                box.style.removeProperty('display');
                box.style.removeProperty('width');
                
                box.dataset.frontResized = text;
                return; 
            }

            // 🚨 1. ALIGNMENT & WRAPPING RULES (For actual Flashcards)
            box.style.setProperty('display', 'block', 'important');
            box.style.setProperty('width', '100%', 'important');
            
            if (box.id === 'fc-back-word') {
                box.style.setProperty('white-space', 'normal', 'important');
                box.style.setProperty('word-break', 'break-all', 'important');
                box.style.setProperty('overflow-wrap', 'anywhere', 'important');
            } else {
                box.style.setProperty('white-space', 'nowrap', 'important');
                box.style.setProperty('word-break', 'keep-all', 'important');
            }

            // 🚀 2. SEPARATE SIZES FOR FRONT AND BACK
            let newSize = '';
            
            if (box.id === 'fc-back-word') {
                if (charCount <= 2) newSize = 'clamp(5rem, 21vw, 5.5rem)'; 
                else if (charCount <= 4) newSize = 'clamp(2.8rem, 14vw, 5rem)'; 
                else if (charCount <= 6) newSize = 'clamp(1.8rem, 7vw, 2rem)'; 
                else newSize = 'clamp(1.3rem, 6vw, 1.5rem)'; 
            } else {
                if (charCount <= 2) newSize = 'clamp(4rem, 20vw, 6rem)'; 
                else if (charCount <= 4) newSize = 'clamp(3rem, 15vw, 4.5rem)'; 
                else if (charCount <= 6) newSize = 'clamp(2rem, 8vw, 2rem)'; 
                else newSize = 'clamp(1.5rem, 8vw, 3rem)'; 
            }

            // 🎯 3. APPLY THE SIZES TO THE BOX AND INNER LETTERS
            box.style.setProperty('font-size', newSize, 'important');
            box.style.setProperty('line-height', '1.2', 'important');
            
            if (box.id === 'fc-back-word') {
                box.style.setProperty('font-weight', 'normal', 'important');
            }
            
        const innerLetters = box.querySelectorAll('*');
            innerLetters.forEach(letter => {
                
                // 🛑 THE ABSOLUTE SHIELD: If it's a sentence or extra info, DO NOT RESIZE IT!
                if (letter.closest('.extra-info-box') || 
                    letter.closest('.fc-ex-zh') || 
                    letter.closest('#fc-sentences-container') || 
                    letter.closest('.fc-sentences-wrapper') || 
                    letter.closest('details')) {
                    
                    // 🔥 Force text wrapping so it never goes off the edge of the screen!
                    letter.style.setProperty('white-space', 'normal', 'important');
                    letter.style.setProperty('word-wrap', 'break-word', 'important');
                    
                    // We completely stop the script here so it DOES NOT make the font giant.
                    return; 
                }

                // Normal resizing for the main flashcard word ONLY
                letter.style.setProperty('font-size', newSize, 'important');
                letter.style.setProperty('line-height', '1.2', 'important');
                
                if (box.id === 'fc-back-word') {
                    letter.style.setProperty('font-weight', 'normal', 'important');
                }
            });
            
            box.dataset.frontResized = text;
        });
    });

    cardSizer.observe(document.body, { childList: true, subtree: true });
});
document.addEventListener('DOMContentLoaded', () => {
    const modalContent = document.querySelector('#char-search-modal .modal-content');
    if (modalContent) {
        // This tells the app: "If I am touching the white popup box, do NOT flip the flashcard!"
        modalContent.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
        modalContent.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true });
        modalContent.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
    }
});
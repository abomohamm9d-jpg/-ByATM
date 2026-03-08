window.addEventListener('load', () => { setTimeout(() => { const splash = document.getElementById('splash-screen'); splash.style.opacity = '0'; setTimeout(() => splash.style.visibility = 'hidden', 600); }, 2500); });
const Toast = Swal.mixin({ toast: true, position: 'bottom-end', showConfirmButton: false, timer: 2500, timerProgressBar: true });

let isRecording = false; 
let currentLang = 'ar'; 
let recognition; 
let finalTranscript = '';

let recordingMode = 'normal'; 
let isAutoTashkeelOn = false;

function toggleRecording(mode) {
    const micBtn = document.getElementById('mic-btn');
    const smartBtn = document.getElementById('smart-btn');
    
    if (isRecording) {
        recognition.stop();
        isRecording = false;
        resetMicUI();
    } else {
        recordingMode = mode;
        isAutoTashkeelOn = (mode === 'smart');
        
        if (mode === 'normal') {
            smartBtn.style.display = 'none'; 
            micBtn.classList.add('mic-active'); 
            Toast.fire({ icon: 'info', title: currentLang === 'ar' ? 'بدأ التسجيل العادي (خام)' : 'Normal Recording Started' });
        } else {
            micBtn.style.display = 'none'; 
            smartBtn.classList.add('smart-active'); 
            Toast.fire({ icon: 'success', title: currentLang === 'ar' ? 'بدأ التسجيل الذكي (بالتشكيل)' : 'Smart Recording Started' });
        }
        
        stopAllAudio(); 
        finalTranscript = document.getElementById('final-text').value;
        recognition.start();
        isRecording = true;
    }
}

function resetMicUI() {
    const micBtn = document.getElementById('mic-btn');
    const smartBtn = document.getElementById('smart-btn');
    
    micBtn.style.display = 'flex';
    smartBtn.style.display = currentLang === 'ar' ? 'flex' : 'none';
    
    micBtn.classList.remove('mic-active');
    smartBtn.classList.remove('smart-active');
    
    const liveDiv = document.getElementById('live-text');
    liveDiv.innerText = currentLang === 'ar' ? "سيظهر هنا ما يسمعه المايك فوراً..." : "Live speech will appear here...";
    liveDiv.style.color = 'var(--text-muted)';
}

function applySmartCorrection(text) {
    if (!text || !isAutoTashkeelOn || currentLang !== 'ar') return text;

    const dictionary = {
        'احمد': 'أَحْمَد', 'أحمد': 'أَحْمَد',
        'اثار': 'آثَار', 'آثار': 'آثَار',
        'الحمد': 'الحَمْدُ', 'الحمدلله': 'الحَمْدُ لِلَّهِ',
        'شكرا': 'شُكْراً', 'عفوا': 'عَفْواً',
        'اهلا': 'أَهْلاً', 'مرحبا': 'مَرْحَباً',
        'جدا': 'جِدّاً', 'ايضا': 'أَيْضاً', 'دائما': 'دَائِماً',
        'الله': 'اللَّهُ', 'بسم': 'بِسْمِ',
        'الرحمن': 'الرَّحْمَنِ', 'الرحيم': 'الرَّحِيمِ',
        'الا': 'إِلَّا', 'انما': 'إِنَّمَا', 'الى': 'إِلَى', 
        'على': 'عَلَى', 'ان': 'إِنَّ', 'انا': 'أَنَا'
    };

    let words = text.split(' ');
    for (let i = 0; i < words.length; i++) {
        let cleanWord = words[i].trim();
        if (dictionary[cleanWord]) {
            words[i] = dictionary[cleanWord];
        }
    }
    return words.join(' ');
}

let textHistory = [];
function saveHistory() { const currentText = document.getElementById('final-text').value; if (textHistory.length === 0 || textHistory[textHistory.length - 1] !== currentText) { textHistory.push(currentText); if(textHistory.length > 20) textHistory.shift(); } }
function undoText() { if (textHistory.length > 1) { textHistory.pop(); const previous = textHistory[textHistory.length - 1]; document.getElementById('final-text').value = previous; finalTranscript = previous; updateCounterAndSave(false); Toast.fire({ icon: 'info', title: currentLang === 'ar' ? 'تم التراجع' : 'Undone' }); } else if (textHistory.length === 1) { document.getElementById('final-text').value = ''; finalTranscript = ''; textHistory = []; updateCounterAndSave(false); Toast.fire({ icon: 'info', title: currentLang === 'ar' ? 'تم التراجع' : 'Undone' }); } else { Toast.fire({ icon: 'warning', title: currentLang === 'ar' ? 'لا يوجد شيء للتراجع' : 'Nothing to undo' }); } }

let synth = window.speechSynthesis;
let voices = []; let selectedVoice = null; let useAIVoice = true; 
let aiAudioObject = null; let aiAudioQueue = []; let isAiPlaying = false;

function populateVoices() {
    voices = synth.getVoices();
    const voiceOptions = document.getElementById('voice-options'); voiceOptions.innerHTML = '';
    const langPrefix = currentLang === 'ar' ? 'ar' : 'en';
    const filteredVoices = voices.filter(v => v.lang.startsWith(langPrefix));
    
    if(filteredVoices.length === 0) { voiceOptions.innerHTML = `<div class="dropdown-item">${currentLang === 'ar' ? 'لا توجد أصوات متوفرة' : 'No voices available'}</div>`; return; }
    
    filteredVoices.forEach((voice, index) => {
        const div = document.createElement('div'); div.className = 'dropdown-item';
        let friendlyName = voice.name.replace(/(Microsoft|Google|Apple)/gi, '').trim() || `صوت ${index + 1}`;
        if(friendlyName.toLowerCase().includes('natural') || friendlyName.toLowerCase().includes('online')) { friendlyName = `⭐ ${friendlyName} (ذكاء اصطناعي)`; }
        div.innerHTML = friendlyName; div.onclick = () => selectVoice(voice, friendlyName); voiceOptions.appendChild(div);
    });
    if(!selectedVoice || !selectedVoice.lang.startsWith(langPrefix)) selectVoice(filteredVoices[0], filteredVoices[0].name.replace(/(Microsoft|Google|Apple)/gi, '').trim());
}
if (speechSynthesis.onvoiceschanged !== undefined) speechSynthesis.onvoiceschanged = populateVoices;

function toggleVoiceEngine() {
    useAIVoice = document.getElementById('ai-toggle').checked;
    document.getElementById('native-voice-container').style.display = useAIVoice ? 'none' : 'block';
    document.getElementById('pitch-container').style.display = useAIVoice ? 'none' : 'flex'; 
    stopAllAudio(); 
    if (!useAIVoice) populateVoices();
    Toast.fire({ icon: 'success', title: useAIVoice ? (currentLang === 'ar' ? 'تم تفعيل الذكاء الاصطناعي السحابي' : 'Cloud AI Activated') : (currentLang === 'ar' ? 'تم التبديل لصوت الكمبيوتر' : 'Computer Voice Activated') });
}

function chunkTextForAI(text) { const words = text.split(' '); const chunks = []; let currentChunk = ''; words.forEach(word => { if ((currentChunk + word).length > 150) { chunks.push(currentChunk.trim()); currentChunk = word + ' '; } else { currentChunk += word + ' '; } }); if (currentChunk) chunks.push(currentChunk.trim()); return chunks; }
function stopAllAudio() { synth.cancel(); isAiPlaying = false; aiAudioQueue = []; if (aiAudioObject) { aiAudioObject.pause(); aiAudioObject.currentTime = 0; aiAudioObject = null; } document.getElementById('listen-text').innerText = currentLang === 'ar' ? 'استماع' : 'Listen'; }

function playNextAIChunk() {
    if (aiAudioQueue.length === 0 || !isAiPlaying) { stopAllAudio(); return; }
    const chunk = aiAudioQueue.shift(); const langCode = currentLang === 'ar' ? 'ar' : 'en';
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${langCode}&client=tw-ob&q=${encodeURIComponent(chunk)}`;
    aiAudioObject = new Audio(url); aiAudioObject.playbackRate = parseFloat(document.getElementById('rate-slider').value);
    aiAudioObject.onended = playNextAIChunk; aiAudioObject.onerror = playNextAIChunk; aiAudioObject.play();
}

function speakText() {
    const text = document.getElementById('final-text').value;
    const listenBtnSpan = document.getElementById('listen-text');
    const t = currentLang === 'ar' ? { listen: "استماع", stop: "إيقاف" } : { listen: "Listen", stop: "Stop" };
    if (!text.trim()) return;
    if (listenBtnSpan.innerText === t.stop) { stopAllAudio(); return; }
    stopAllAudio(); listenBtnSpan.innerText = t.stop;

    if (useAIVoice) {
        isAiPlaying = true; aiAudioQueue = chunkTextForAI(text); playNextAIChunk();
    } else {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = currentLang === 'ar' ? 'ar-SA' : 'en-US'; 
        if (selectedVoice) utterance.voice = selectedVoice;
        utterance.rate = parseFloat(document.getElementById('rate-slider').value);
        utterance.pitch = parseFloat(document.getElementById('pitch-slider').value);
        utterance.onend = function() { listenBtnSpan.innerText = t.listen; };
        utterance.onerror = function() { listenBtnSpan.innerText = t.listen; };
        synth.speak(utterance);
    }
}

function downloadAudio() { const text = document.getElementById('final-text').value.trim(); if(!text) return Toast.fire({ icon: 'warning', title: currentLang === 'ar' ? 'لا يوجد نص!' : 'No text!' }); if(text.length > 200) { Swal.fire({ icon: 'info', title: currentLang === 'ar' ? 'ملاحظة' : 'Note', text: currentLang === 'ar' ? 'التحميل هيتم للنصوص القصيرة لضمان الجودة، قد يتم الاقتطاع.' : 'Download is for short texts. Long texts may be truncated.', confirmButtonText: currentLang === 'ar' ? 'استمرار' : 'Continue' }).then((result) => { if (result.isConfirmed) executeDownload(text); }); } else { executeDownload(text); } }
function executeDownload(text) { const langCode = currentLang === 'ar' ? 'ar' : 'en'; const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${langCode}&client=tw-ob&q=${encodeURIComponent(text.substring(0, 200))}`; const link = document.createElement('a'); link.href = url; link.download = `Atheer_Audio.mp3`; document.body.appendChild(link); link.click(); document.body.removeChild(link); Toast.fire({ icon: 'success', title: currentLang === 'ar' ? 'جاري التحميل...' : 'Downloading...' }); }

function toggleDropdown(id) { const dropdown = document.getElementById(id); const isActive = dropdown.classList.contains('active'); document.querySelectorAll('.dropdown-options').forEach(el => el.classList.remove('active')); if (!isActive) dropdown.classList.add('active'); }
document.addEventListener('click', function(e) { if (!e.target.closest('.custom-dropdown')) document.querySelectorAll('.dropdown-options').forEach(el => el.classList.remove('active')); });
function selectFont(fontFamily, fontName) { document.getElementById('final-text').style.fontFamily = fontFamily + ", sans-serif"; document.getElementById('selected-font-text').innerHTML = `<i class="fa-solid fa-font"></i> ${fontName}`; document.getElementById('font-options').classList.remove('active'); }
function selectVoice(voice, voiceName) { selectedVoice = voice; document.getElementById('selected-voice-text').innerHTML = `<i class="fa-solid fa-headset"></i> ${voiceName.substring(0, 15)}...`; document.getElementById('voice-options').classList.remove('active'); }
function updateRateLabel() { document.getElementById('rate-label').innerText = document.getElementById('rate-slider').value; }
function updatePitchLabel() { document.getElementById('pitch-label').innerText = document.getElementById('pitch-slider').value; }

window.onload = function() { const savedText = localStorage.getItem('savedVoiceText'); if(savedText) { document.getElementById('final-text').value = savedText; finalTranscript = savedText; updateCounterAndSave(true); } setTimeout(populateVoices, 500); };

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition(); recognition.continuous = true; recognition.interimResults = true; recognition.lang = 'ar-SA';
    
    recognition.onresult = function(event) {
        let interimTranscript = ''; let hasFinal = false;
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            let textSegment = event.results[i][0].transcript.trim();
            
            if (event.results[i].isFinal) { 
                textSegment = applySmartCorrection(textSegment);
                finalTranscript += textSegment + ' '; 
                document.getElementById('final-text').value = finalTranscript; 
                hasFinal = true; 
            } else { 
                interimTranscript += textSegment; 
            }
        }
        if(hasFinal) updateCounterAndSave(true);
        const liveDiv = document.getElementById('live-text'); 
        liveDiv.innerText = interimTranscript || (currentLang === 'ar' ? "سيظهر هنا ما يسمعه المايك فوراً..." : "Live speech will appear here..."); 
        liveDiv.style.color = interimTranscript ? 'var(--primary)' : 'var(--text-muted)';
    };
    
    recognition.onend = function() { 
        if (isRecording) {
            recognition.start();
        } else {
            resetMicUI();
        }
    };
}

function updateCounterAndSave(saveToHistory = true) { const text = document.getElementById('final-text').value; localStorage.setItem('savedVoiceText', text); finalTranscript = text; const wordsCount = text.trim() === '' ? 0 : text.trim().split(/\s+/).length; document.getElementById('word-counter').innerText = currentLang === 'ar' ? `الكلمات: ${wordsCount} | الحروف: ${text.length}` : `Words: ${wordsCount} | Chars: ${text.length}`; if(saveToHistory) saveHistory(); }

function clearText() { Swal.fire({ title: currentLang==='ar'?'تصفير الشاشة؟':'Clear Screen?', text: currentLang==='ar'?'سيتم مسح النص والتاريخ بالكامل':'All text and history will be deleted', icon: 'warning', showCancelButton: true, confirmButtonColor: 'var(--danger)', confirmButtonText: currentLang==='ar'?'نعم، صفر':'Yes, clear' }).then((r) => { if (r.isConfirmed) { document.getElementById('final-text').value = ''; finalTranscript = ''; textHistory = []; updateCounterAndSave(false); Toast.fire({icon: 'success', title: currentLang==='ar'?'تم التصفير':'Cleared'}); } }); }
function copyText() { document.getElementById('final-text').select(); document.execCommand('copy'); Toast.fire({ icon: 'success', title: currentLang==='ar'?'تم النسخ!':'Copied!' }); }
function exportWord() { const text = document.getElementById('final-text').value; if(!text)return; const blob = new Blob(['\ufeff', text], { type: 'application/msword' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'Atheer_Note.doc'; link.click(); }

async function translateText() {
    const text = document.getElementById('final-text').value; if(!text) return;
    Swal.fire({ title: currentLang==='ar'?'جاري الترجمة...':'Translating...', didOpen: () => Swal.showLoading() });
    const toLang = currentLang === 'ar' ? 'en' : 'ar';
    try { const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${toLang}&dt=t&q=${encodeURIComponent(text)}`); const data = await res.json(); document.getElementById('final-text').value = data[0].map(item => item[0]).join(''); updateCounterAndSave(true); Swal.close(); } catch (e) { Swal.fire('خطأ!', 'تعذرت الترجمة', 'error'); }
}

function addTashkeel() { let text = document.getElementById('final-text').value; if(!text||currentLang!=='ar')return; let nText = ''; for(let i=0;i<text.length;i++){ nText+=text[i]; if(text[i].match(/[أ-ي]/)&&Math.random()>0.6)nText+=['َ','ِ','ُ','ْ','ّ'][Math.floor(Math.random()*5)]; } document.getElementById('final-text').value = nText; updateCounterAndSave(true); }
function addTazyeen() { let text = document.getElementById('final-text').value; if(!text)return; document.getElementById('final-text').value = currentLang==='ar'? `﴿ ${text.replace(/([بترثجحخدذرزسشصضطظعغفقكلمنهي])/g,'$1ـ').trim()} ﴾` : `✨ ${text} ✨`; updateCounterAndSave(true); }

function toggleLanguage() {
    if (isRecording) { recognition.stop(); isRecording = false; resetMicUI(); }
    stopAllAudio();
    currentLang = currentLang === 'ar' ? 'en' : 'ar';
    document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr'; document.documentElement.lang = currentLang;
    document.getElementById('lang-text').innerText = currentLang === 'ar' ? 'English' : 'عربي'; document.getElementById('live-title').innerText = currentLang === 'ar' ? 'المايك يسمع الآن...' : 'Mic is hearing...'; document.getElementById('final-title').innerText = currentLang === 'ar' ? 'النص النهائي' : 'Final Text'; document.getElementById('listen-text').innerText = currentLang === 'ar' ? 'استماع' : 'Listen'; document.getElementById('undo-text').innerText = currentLang === 'ar' ? 'تراجع' : 'Undo'; document.getElementById('clear-text').innerText = currentLang === 'ar' ? 'تصفير' : 'Clear';
    
    document.getElementById('smart-btn').style.display = currentLang === 'ar' ? 'flex' : 'none';

    recognition.lang = currentLang === 'ar' ? 'ar-SA' : 'en-US';
    updateCounterAndSave(false); populateVoices();
}

function toggleTheme() {
    const html = document.documentElement; const themeBtnIcon = document.querySelector('#theme-btn i');
    if (html.getAttribute('data-theme') === 'dark') { html.removeAttribute('data-theme'); themeBtnIcon.className = 'fa-solid fa-moon'; document.getElementById('theme-text').innerText = currentLang === 'ar' ? 'ليلي' : 'Dark'; document.getElementById('ai-icon').style.color = 'var(--primary)'; } 
    else { html.setAttribute('data-theme', 'dark'); themeBtnIcon.className = 'fa-solid fa-sun'; document.getElementById('theme-text').innerText = currentLang === 'ar' ? 'نهاري' : 'Light'; document.getElementById('ai-icon').style.color = 'var(--purple)'; }
}
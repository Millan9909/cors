// متغيرات عامة
let player;
let currentVideo = null;
let watchedVideos = JSON.parse(localStorage.getItem('watchedVideos')) || [];
let certificates = JSON.parse(localStorage.getItem('certificates')) || [];
let courses = JSON.parse(localStorage.getItem('courses')) || [];
let currentProgress = 0;
let videoDuration = 0;
let watchThreshold = 80; // نسبة المشاهدة المطلوبة للحصول على الشهادة

// YouTube API Key - يجب الحصول عليه من Google Cloud Console
const YOUTUBE_API_KEY = 'YOUR_YOUTUBE_API_KEY_HERE';

// تهيئة YouTube Player API
function onYouTubeIframeAPIReady() {
    console.log('YouTube API جاهز');
}

// استخراج معرف الفيديو من رابط اليوتيوب
function extractVideoId(url) {
    let videoId = null;
    const youtubeRegexes = [
        /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    ];

    for (const regex of youtubeRegexes) {
        const match = url.match(regex);
        if (match && match[1]) {
            videoId = match[1];
            break;
        }
    }
    return videoId;
}

// استخراج معرف قائمة التشغيل
function extractPlaylistId(url) {
    const regex = /[&?]list=([^&]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

// الحصول على معلومات الفيديو من YouTube API
async function getVideoInfo(videoId) {
    try {
        const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${YOUTUBE_API_KEY}`);
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
            const video = data.items[0];
            return {
                id: videoId,
                title: video.snippet.title,
                thumbnail: video.snippet.thumbnails.medium.url,
                duration: parseDuration(video.contentDetails.duration),
                description: video.snippet.description
            };
        }
    } catch (error) {
        console.error('خطأ في جلب معلومات الفيديو:', error);
    }
    return null;
}

// تحويل مدة الفيديو من تنسيق ISO 8601
function parseDuration(duration) {
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    const hours = (match[1] || '').replace('H', '') || 0;
    const minutes = (match[2] || '').replace('M', '') || 0;
    const seconds = (match[3] || '').replace('S', '') || 0;
    
    return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
}

// الحصول على معلومات قائمة التشغيل
async function getPlaylistInfo(playlistId) {
    try {
        const response = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=50&key=${YOUTUBE_API_KEY}`);
        const data = await response.json();
        
        if (data.items) {
            const videos = [];
            for (const item of data.items) {
                const videoInfo = await getVideoInfo(item.snippet.resourceId.videoId);
                if (videoInfo) {
                    videos.push(videoInfo);
                }
            }
            return videos;
        }
    } catch (error) {
        console.error('خطأ في جلب معلومات قائمة التشغيل:', error);
    }
    return [];
}

// إضافة فيديو واحد
async function addSingleVideo() {
    const url = document.getElementById('videoUrl').value;
    if (!url) {
        alert('يرجى إدخال رابط الفيديو');
        return;
    }
    
    const videoId = extractVideoId(url);
    if (!videoId) {
        alert('رابط غير صحيح');
        return;
    }
    
    const videoInfo = await getVideoInfo(videoId);
    if (videoInfo) {
        const course = {
            id: Date.now(),
            title: videoInfo.title,
            videos: [videoInfo],
            type: 'single'
        };
        
        courses.push(course);
        localStorage.setItem('courses', JSON.stringify(courses));
        displayCourses();
        document.getElementById('videoUrl').value = '';
        alert('تم إضافة الفيديو بنجاح!');
    } else {
        alert('فشل في جلب معلومات الفيديو');
    }
}

// إضافة قائمة تشغيل
async function addPlaylist() {
    const url = document.getElementById('playlistUrl').value;
    if (!url) {
        alert('يرجى إدخال رابط قائمة التشغيل');
        return;
    }
    
    const playlistId = extractPlaylistId(url);
    if (!playlistId) {
        alert('رابط قائمة التشغيل غير صحيح');
        return;
    }
    
    const videos = await getPlaylistInfo(playlistId);
    if (videos.length > 0) {
        const course = {
            id: Date.now(),
            title: `قائمة تشغيل - ${videos[0].title}`,
            videos: videos,
            type: 'playlist'
        };
        
        courses.push(course);
        localStorage.setItem('courses', JSON.stringify(courses));
        displayCourses();
        document.getElementById('playlistUrl').value = '';
        alert(`تم إضافة قائمة التشغيل بنجاح! (${videos.length} فيديو)`);
    } else {
        alert('فشل في جلب معلومات قائمة التشغيل');
    }
}

// عرض الدورات
function displayCourses() {
    const coursesList = document.getElementById('coursesList');
    coursesList.innerHTML = '';
    
    courses.forEach(course => {
        const courseCard = document.createElement('div');
        courseCard.className = 'course-card';
        
        const thumbnail = course.videos[0].thumbnail;
        const totalDuration = course.videos.reduce((total, video) => total + video.duration, 0);
        const durationText = formatDuration(totalDuration);
        
        courseCard.innerHTML = `
            <img src="${thumbnail}" alt="${course.title}" class="course-thumbnail">
            <div class="course-info">
                <h3 class="course-title">${course.title}</h3>
                <p class="course-duration">المدة: ${durationText} | ${course.videos.length} فيديو</p>
                <button class="start-course-btn" onclick="startCourse(${course.id})">بدء الدورة</button>
            </div>
        `;
        
        coursesList.appendChild(courseCard);
    });
}

// تنسيق المدة
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
        return `${hours}س ${minutes}د`;
    }
    return `${minutes}د`;
}

// بدء الدورة
function startCourse(courseId) {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;
    
    currentVideo = course.videos[0];
    document.getElementById('videoPlayer').style.display = 'block';
    document.getElementById('videoTitle').textContent = currentVideo.title;
    
    // إنشاء مشغل اليوتيوب
    if (player) {
        player.loadVideoById(currentVideo.id);
    } else {
        player = new YT.Player('player', {
            height: '400',
            width: '100%',
            videoId: currentVideo.id,
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange
            }
        });
    }
    
    // التمرير إلى مشغل الفيديو
    document.getElementById('videoPlayer').scrollIntoView({ behavior: 'smooth' });
}

// عند جاهزية المشغل
function onPlayerReady(event) {
    videoDuration = player.getDuration();
    startProgressTracking();
}

// عند تغيير حالة المشغل
function onPlayerStateChange(event) {
    if (event.data == YT.PlayerState.PLAYING) {
        startProgressTracking();
    } else if (event.data == YT.PlayerState.PAUSED || event.data == YT.PlayerState.ENDED) {
        stopProgressTracking();
    }
}

// متتبع التقدم
let progressInterval;

function startProgressTracking() {
    if (progressInterval) clearInterval(progressInterval);
    
    progressInterval = setInterval(() => {
        if (player && player.getCurrentTime) {
            const currentTime = player.getCurrentTime();
            const duration = player.getDuration();
            
            if (duration > 0) {
                currentProgress = (currentTime / duration) * 100;
                updateProgressBar(currentProgress);
                
                // التحقق من إكمال المشاهدة
                if (currentProgress >= watchThreshold && !isVideoWatched(currentVideo.id)) {
                    markVideoAsWatched(currentVideo.id);
                    showCertificateButton();
                }
            }
        }
    }, 1000);
}

function stopProgressTracking() {
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
}

// تحديث شريط التقدم
function updateProgressBar(progress) {
    document.getElementById('progressFill').style.width = progress + '%';
    document.getElementById('progressText').textContent = `التقدم: ${Math.round(progress)}%`;
}

// التحقق من مشاهدة الفيديو
function isVideoWatched(videoId) {
    return watchedVideos.includes(videoId);
}

// تسجيل الفيديو كمُشاهد
function markVideoAsWatched(videoId) {
    if (!watchedVideos.includes(videoId)) {
        watchedVideos.push(videoId);
        localStorage.setItem('watchedVideos', JSON.stringify(watchedVideos));
    }
}

// إظهار زر الشهادة
function showCertificateButton() {
    document.getElementById('certificateBtn').style.display = 'block';
}

// إنشاء الشهادة
function generateCertificate() {
    if (!currentVideo) return;
    
    const certificate = {
        id: Date.now(),
        videoTitle: currentVideo.title,
        completionDate: new Date().toLocaleDateString('ar-SA'),
        recipientName: 'المتدرب' // يمكن تخصيصه
    };
    
    certificates.push(certificate);
    localStorage.setItem('certificates', JSON.stringify(certificates));
    
    showCertificateModal(certificate);
    displayCertificates();
}

// عرض نافذة الشهادة
function showCertificateModal(certificate) {
    const modal = document.getElementById('certificateModal');
    const content = document.getElementById('certificateContent');
    
    content.innerHTML = `
        <div class="certificate">
            <h2>🏆 شهادة إتمام الدورة</h2>
            <p>نشهد بأن</p>
            <div class="recipient">${certificate.recipientName}</div>
            <p>قد أتم بنجاح مشاهدة</p>
            <div class="course-name">"${certificate.videoTitle}"</div>
            <div class="date">تاريخ الإتمام: ${certificate.completionDate}</div>
        </div>
    `;
    
    modal.style.display = 'block';
}

// إغلاق نافذة الشهادة
function closeCertificateModal() {
    document.getElementById('certificateModal').style.display = 'none';
}

// تحميل الشهادة
function downloadCertificate() {
    // يمكن تطوير هذه الوظيفة لتحميل الشهادة كصورة أو PDF
    alert('سيتم تطوير وظيفة التحميل قريباً');
}

// عرض الشهادات
function displayCertificates() {
    const certificatesList = document.getElementById('certificatesList');
    certificatesList.innerHTML = '';
    
    certificates.forEach(certificate => {
        const certificateCard = document.createElement('div');
        certificateCard.className = 'certificate-card';
        
        certificateCard.innerHTML = `
            <div class="certificate-icon">🏆</div>
            <h4>${certificate.videoTitle}</h4>
            <p>تاريخ الإتمام: ${certificate.completionDate}</p>
            <button onclick="showCertificateModal(${JSON.stringify(certificate).replace(/"/g, '&quot;')})">عرض الشهادة</button>
        `;
        
        certificatesList.appendChild(certificateCard);
    });
}

// تهيئة الصفحة
document.addEventListener('DOMContentLoaded', function() {
    displayCourses();
    displayCertificates();
    
    // إغلاق النافذة المنبثقة عند النقر خارجها
    window.onclick = function(event) {
        const modal = document.getElementById('certificateModal');
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    }
});
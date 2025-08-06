/**
 * AudioPlayerService - Handles audio playback functionality
 * Manages play/pause, progress tracking, volume control, and playlist navigation
 */
class AudioPlayerService extends ServiceBase {
    constructor(eventBus, stateManager) {
        super(eventBus, stateManager);
        
        // Audio state
        this.currentTrack = null;
        this.isPlaying = false;
        this.isMuted = false;
        this.volume = 0.8;
        this.duration = 0;
        this.currentTime = 0;
        this.isShuffled = false;
        this.repeatMode = 'none'; // 'none', 'one', 'all'
        
        // DOM elements
        this.elements = {};
        
        // Progress tracking
        this.progressUpdateInterval = null;
        this.isDraggingProgress = false;
        this.isDraggingVolume = false;
        
        console.log('🔊 AudioPlayerService initialized');
    }
    
    initialize() {
        super.initialize();
        
        // Cache DOM elements
        this.cacheElements();
        
        // Setup audio element
        this.setupAudioElement();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Subscribe to playlist events
        this.subscribeToPlaylistEvents();
        
        // Set initial volume
        this.setVolume(this.volume);
        
        console.log('🔊 AudioPlayerService initialized with DOM elements');
    }
    
    cacheElements() {
        this.elements = {
            audioElement: document.getElementById('audioElement'),
            playPauseBtn: document.getElementById('playPauseBtn'),
            prevBtn: document.getElementById('prevBtn'),
            nextBtn: document.getElementById('nextBtn'),
            shuffleBtn: document.getElementById('shuffleBtn'),
            repeatBtn: document.getElementById('repeatBtn'),
            volumeBtn: document.getElementById('volumeBtn'),
            
            // Track info
            currentTrackTitle: document.getElementById('currentTrackTitle'),
            currentTrackArtist: document.getElementById('currentTrackArtist'),
            trackArtwork: document.getElementById('trackArtwork'),
            
            // Progress
            progressBarContainer: document.getElementById('progressBarContainer'),
            progressFill: document.getElementById('progressFill'),
            progressHandle: document.getElementById('progressHandle'),
            currentTime: document.getElementById('currentTime'),
            totalTime: document.getElementById('totalTime'),
            
            // Volume
            volumeSliderContainer: document.getElementById('volumeSliderContainer'),
            volumeFill: document.getElementById('volumeFill'),
            volumeHandle: document.getElementById('volumeHandle'),
            volumeIcon: document.querySelector('.volume-icon'),
            
            // Icons
            playIcon: document.querySelector('.play-icon'),
            pauseIcon: document.querySelector('.pause-icon')
        };
    }
    
    setupAudioElement() {
        if (!this.elements.audioElement) return;
        
        const audio = this.elements.audioElement;
        
        // Audio event listeners
        audio.addEventListener('loadedmetadata', () => {
            this.duration = audio.duration;
            this.updateTimeDisplay();
        });
        
        audio.addEventListener('timeupdate', () => {
            if (!this.isDraggingProgress) {
                this.currentTime = audio.currentTime;
                this.updateProgressBar();
            }
        });
        
        audio.addEventListener('ended', () => {
            this.handleTrackEnd();
        });
        
        audio.addEventListener('error', (e) => {
            console.error('Audio error:', e);
            this.handleAudioError();
        });
        
        audio.addEventListener('canplay', () => {
            console.log('Audio can play');
        });
    }
    
    setupEventListeners() {
        // Play/Pause button
        this.elements.playPauseBtn?.addEventListener('click', () => {
            this.togglePlayPause();
        });
        
        // Previous/Next buttons
        this.elements.prevBtn?.addEventListener('click', () => {
            this.previousTrack();
        });
        
        this.elements.nextBtn?.addEventListener('click', () => {
            this.nextTrack();
        });
        
        // Shuffle button
        this.elements.shuffleBtn?.addEventListener('click', () => {
            this.toggleShuffle();
        });
        
        // Repeat button
        this.elements.repeatBtn?.addEventListener('click', () => {
            this.toggleRepeat();
        });
        
        // Volume button
        this.elements.volumeBtn?.addEventListener('click', () => {
            this.toggleMute();
        });
        
        // Progress bar interactions
        this.setupProgressBarListeners();
        
        // Volume slider interactions
        this.setupVolumeSliderListeners();
    }
    
    setupProgressBarListeners() {
        const container = this.elements.progressBarContainer;
        if (!container) return;
        
        container.addEventListener('click', (e) => {
            if (this.isDraggingProgress) return;
            this.seekToPosition(e);
        });
        
        // Progress handle dragging
        const handle = this.elements.progressHandle;
        if (!handle) return;
        
        let isDragging = false;
        
        handle.addEventListener('mousedown', (e) => {
            isDragging = true;
            this.isDraggingProgress = true;
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            this.seekToPosition(e);
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                this.isDraggingProgress = false;
            }
        });
    }
    
    setupVolumeSliderListeners() {
        const container = this.elements.volumeSliderContainer;
        if (!container) return;
        
        container.addEventListener('click', (e) => {
            if (this.isDraggingVolume) return;
            this.setVolumeFromPosition(e);
        });
        
        // Volume handle dragging
        const handle = this.elements.volumeHandle;
        if (!handle) return;
        
        let isDragging = false;
        
        handle.addEventListener('mousedown', (e) => {
            isDragging = true;
            this.isDraggingVolume = true;
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            this.setVolumeFromPosition(e);
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                this.isDraggingVolume = false;
            }
        });
    }
    
    subscribeToPlaylistEvents() {
        this.subscribeToEvent('playlist:track-added', (data) => {
            // If no track is playing and this is the first track, load it
            if (!this.currentTrack) {
                this.loadFirstTrackFromPlaylist();
            }
        });
        
        this.subscribeToEvent('playlist:cleared', () => {
            this.stop();
            this.clearTrackInfo();
        });
        
        this.subscribeToEvent('playlist:track-selected', (data) => {
            this.loadTrack(data.track, data.index);
        });
    }
    
    // Playlist integration methods
    loadFirstTrackFromPlaylist() {
        const playlistEntries = this.stateManager.getState('playlist.entries') || [];
        if (playlistEntries.length > 0) {
            this.loadTrack(playlistEntries[0].track, 0);
        }
    }
    
    loadTrack(track, index = 0) {
        if (!track || !this.elements.audioElement) return;
        
        this.currentTrack = track;
        this.setState('audioPlayer.currentTrackIndex', index);
        this.setState('audioPlayer.currentTrack', track);
        
        // Update UI with track info
        this.updateTrackInfo(track);
        
        // For demo purposes, we'll use a placeholder URL
        // In production, this would be the actual file path/URL
        const audioUrl = this.getTrackUrl(track);
        
        if (audioUrl) {
            this.elements.audioElement.src = audioUrl;
            console.log(`🔊 Loading track: ${track.title} by ${track.artist}`);
        } else {
            console.warn('🔊 No audio URL available for track:', track);
            this.handleAudioError();
        }
    }
    
    getTrackUrl(track) {
        // In a real implementation, this would return the actual file path
        // For demo purposes, return null to simulate no audio file
        // You could implement file path resolution from your music library here
        return track.filePath || track.url || null;
    }
    
    updateTrackInfo(track) {
        if (this.elements.currentTrackTitle) {
            this.elements.currentTrackTitle.textContent = track.title || 'Titolo sconosciuto';
        }
        if (this.elements.currentTrackArtist) {
            this.elements.currentTrackArtist.textContent = track.artist || 'Artista sconosciuto';
        }
        
        // Update artwork (placeholder for now)
        if (this.elements.trackArtwork) {
            const placeholder = this.elements.trackArtwork.querySelector('.artwork-placeholder');
            if (placeholder) {
                placeholder.textContent = '🎵';
            }
        }
    }
    
    clearTrackInfo() {
        if (this.elements.currentTrackTitle) {
            this.elements.currentTrackTitle.textContent = 'Nessuna traccia in riproduzione';
        }
        if (this.elements.currentTrackArtist) {
            this.elements.currentTrackArtist.textContent = 'Seleziona una traccia per iniziare';
        }
        
        this.currentTrack = null;
        this.setState('audioPlayer.currentTrack', null);
        this.setState('audioPlayer.currentTrackIndex', -1);
    }
    
    // Playback control methods
    async togglePlayPause() {
        if (!this.elements.audioElement || !this.currentTrack) {
            console.warn('🔊 No audio element or track loaded');
            return;
        }
        
        try {
            if (this.isPlaying) {
                await this.pause();
            } else {
                await this.play();
            }
        } catch (error) {
            console.error('🔊 Playback error:', error);
            this.handleAudioError();
        }
    }
    
    async play() {
        if (!this.elements.audioElement) return;
        
        try {
            await this.elements.audioElement.play();
            this.isPlaying = true;
            this.setState('audioPlayer.isPlaying', true);
            this.updatePlayPauseButton();
            this.startProgressTracking();
            
            console.log('🔊 Playback started');
        } catch (error) {
            console.error('🔊 Play error:', error);
            throw error;
        }
    }
    
    pause() {
        if (!this.elements.audioElement) return;
        
        this.elements.audioElement.pause();
        this.isPlaying = false;
        this.setState('audioPlayer.isPlaying', false);
        this.updatePlayPauseButton();
        this.stopProgressTracking();
        
        console.log('🔊 Playback paused');
    }
    
    stop() {
        if (!this.elements.audioElement) return;
        
        this.elements.audioElement.pause();
        this.elements.audioElement.currentTime = 0;
        this.isPlaying = false;
        this.currentTime = 0;
        this.setState('audioPlayer.isPlaying', false);
        this.updatePlayPauseButton();
        this.updateProgressBar();
        this.stopProgressTracking();
        
        console.log('🔊 Playback stopped');
    }
    
    previousTrack() {
        const currentIndex = this.stateManager.getState('audioPlayer.currentTrackIndex') || 0;
        const playlistEntries = this.stateManager.getState('playlist.entries') || [];
        
        if (playlistEntries.length === 0) return;
        
        let prevIndex = currentIndex - 1;
        if (prevIndex < 0) {
            prevIndex = playlistEntries.length - 1; // Loop to last track
        }
        
        this.loadTrack(playlistEntries[prevIndex].track, prevIndex);
        
        // Auto-play if currently playing
        if (this.isPlaying) {
            setTimeout(() => this.play(), 100);
        }
    }
    
    nextTrack() {
        const currentIndex = this.stateManager.getState('audioPlayer.currentTrackIndex') || 0;
        const playlistEntries = this.stateManager.getState('playlist.entries') || [];
        
        if (playlistEntries.length === 0) return;
        
        let nextIndex;
        
        if (this.isShuffled) {
            // Random track selection
            nextIndex = Math.floor(Math.random() * playlistEntries.length);
        } else {
            nextIndex = currentIndex + 1;
            if (nextIndex >= playlistEntries.length) {
                if (this.repeatMode === 'all') {
                    nextIndex = 0; // Loop to first track
                } else {
                    return; // End of playlist
                }
            }
        }
        
        this.loadTrack(playlistEntries[nextIndex].track, nextIndex);
        
        // Auto-play if currently playing
        if (this.isPlaying) {
            setTimeout(() => this.play(), 100);
        }
    }
    
    handleTrackEnd() {
        console.log('🔊 Track ended');
        
        if (this.repeatMode === 'one') {
            // Repeat current track
            this.elements.audioElement.currentTime = 0;
            this.play();
        } else {
            // Move to next track
            this.nextTrack();
        }
    }
    
    // Progress bar methods
    seekToPosition(event) {
        if (!this.elements.progressBarContainer || !this.elements.audioElement) return;
        
        const rect = this.elements.progressBarContainer.getBoundingClientRect();
        const percentage = (event.clientX - rect.left) / rect.width;
        const targetTime = percentage * this.duration;
        
        this.elements.audioElement.currentTime = Math.max(0, Math.min(targetTime, this.duration));
        this.currentTime = this.elements.audioElement.currentTime;
        this.updateProgressBar();
    }
    
    updateProgressBar() {
        if (!this.elements.progressFill || this.duration === 0) return;
        
        const percentage = (this.currentTime / this.duration) * 100;
        this.elements.progressFill.style.width = `${Math.max(0, Math.min(percentage, 100))}%`;
        
        this.updateTimeDisplay();
    }
    
    updateTimeDisplay() {
        if (this.elements.currentTime) {
            this.elements.currentTime.textContent = this.formatTime(this.currentTime);
        }
        if (this.elements.totalTime) {
            this.elements.totalTime.textContent = this.formatTime(this.duration);
        }
    }
    
    // Volume methods
    setVolumeFromPosition(event) {
        if (!this.elements.volumeSliderContainer) return;
        
        const rect = this.elements.volumeSliderContainer.getBoundingClientRect();
        const percentage = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        
        this.setVolume(percentage);
    }
    
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        
        if (this.elements.audioElement) {
            this.elements.audioElement.volume = this.volume;
        }
        
        this.updateVolumeDisplay();
        this.setState('audioPlayer.volume', this.volume);
        
        // Update mute state
        if (this.volume === 0 && !this.isMuted) {
            this.isMuted = true;
        } else if (this.volume > 0 && this.isMuted) {
            this.isMuted = false;
        }
        
        this.updateVolumeIcon();
    }
    
    toggleMute() {
        if (this.isMuted) {
            this.setVolume(this.stateManager.getState('audioPlayer.previousVolume') || 0.8);
            this.isMuted = false;
        } else {
            this.setState('audioPlayer.previousVolume', this.volume);
            this.setVolume(0);
            this.isMuted = true;
        }
        
        this.updateVolumeIcon();
    }
    
    updateVolumeDisplay() {
        if (this.elements.volumeFill) {
            this.elements.volumeFill.style.width = `${this.volume * 100}%`;
        }
    }
    
    updateVolumeIcon() {
        if (!this.elements.volumeIcon || !this.elements.volumeBtn) return;
        
        const btn = this.elements.volumeBtn;
        const icon = this.elements.volumeIcon;
        
        if (this.isMuted || this.volume === 0) {
            icon.textContent = '🔇';
            btn.classList.add('muted');
        } else if (this.volume < 0.3) {
            icon.textContent = '🔈';
            btn.classList.remove('muted');
        } else if (this.volume < 0.7) {
            icon.textContent = '🔉';
            btn.classList.remove('muted');
        } else {
            icon.textContent = '🔊';
            btn.classList.remove('muted');
        }
    }
    
    // Control button methods
    toggleShuffle() {
        this.isShuffled = !this.isShuffled;
        this.setState('audioPlayer.isShuffled', this.isShuffled);
        
        if (this.elements.shuffleBtn) {
            this.elements.shuffleBtn.classList.toggle('active', this.isShuffled);
        }
        
        console.log('🔊 Shuffle:', this.isShuffled ? 'ON' : 'OFF');
    }
    
    toggleRepeat() {
        const modes = ['none', 'all', 'one'];
        const currentIndex = modes.indexOf(this.repeatMode);
        this.repeatMode = modes[(currentIndex + 1) % modes.length];
        
        this.setState('audioPlayer.repeatMode', this.repeatMode);
        
        if (this.elements.repeatBtn) {
            this.elements.repeatBtn.classList.toggle('active', this.repeatMode !== 'none');
            
            // Update button text based on mode
            const span = this.elements.repeatBtn.querySelector('span');
            if (span) {
                switch (this.repeatMode) {
                    case 'one':
                        span.textContent = '🔂';
                        break;
                    case 'all':
                        span.textContent = '🔁';
                        break;
                    default:
                        span.textContent = '🔁';
                }
            }
        }
        
        console.log('🔊 Repeat mode:', this.repeatMode);
    }
    
    updatePlayPauseButton() {
        if (!this.elements.playIcon || !this.elements.pauseIcon || !this.elements.playPauseBtn) return;
        
        const btn = this.elements.playPauseBtn;
        const playIcon = this.elements.playIcon;
        const pauseIcon = this.elements.pauseIcon;
        
        if (this.isPlaying) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'inline';
            btn.classList.add('playing');
        } else {
            playIcon.style.display = 'inline';
            pauseIcon.style.display = 'none';
            btn.classList.remove('playing');
        }
    }
    
    // Progress tracking
    startProgressTracking() {
        this.stopProgressTracking();
        this.progressUpdateInterval = setInterval(() => {
            if (this.elements.audioElement && !this.isDraggingProgress) {
                this.currentTime = this.elements.audioElement.currentTime;
                this.updateProgressBar();
            }
        }, 100);
    }
    
    stopProgressTracking() {
        if (this.progressUpdateInterval) {
            clearInterval(this.progressUpdateInterval);
            this.progressUpdateInterval = null;
        }
    }
    
    // Utility methods
    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
    
    handleAudioError() {
        console.error('🔊 Audio error - stopping playback');
        this.stop();
        
        // Show error in track info
        if (this.elements.currentTrackTitle) {
            this.elements.currentTrackTitle.textContent = 'Errore di riproduzione';
        }
        if (this.elements.currentTrackArtist) {
            this.elements.currentTrackArtist.textContent = 'File audio non disponibile';
        }
    }
    
    // Cleanup
    destroy() {
        this.stopProgressTracking();
        this.stop();
        super.destroy();
        console.log('🔊 AudioPlayerService destroyed');
    }
}
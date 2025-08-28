document.addEventListener('DOMContentLoaded', () => {
  const selectDirBtn = document.getElementById('select-dir-btn');
  const scanBtn = document.getElementById('scan-btn');
  const selectedDirEl = document.getElementById('selected-dir');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  const tracksCountEl = document.getElementById('tracks-count');
  const artistsCountEl = document.getElementById('artists-count');
  const albumsCountEl = document.getElementById('albums-count');

  const artistsListEl = document.getElementById('artists-list');

  let selectedDirectory = null;

  selectDirBtn.addEventListener('click', async () => {
    selectedDirectory = await window.electronAPI.selectMusicDirectory();
    if (selectedDirectory) {
      selectedDirEl.textContent = `Selected Directory: ${selectedDirectory}`;
      scanBtn.disabled = false;
    }
  });

  scanBtn.addEventListener('click', async () => {
    if (!selectedDirectory) {
      alert('Please select a directory first.');
      return;
    }

    scanBtn.disabled = true;
    selectDirBtn.disabled = true;
    progressBar.style.width = '0%';
    progressText.textContent = 'Starting scan...';

    window.electronAPI.onScanProgress((progress) => {
      const percentage = (progress.current / progress.total) * 100;
      progressBar.style.width = `${percentage}%`;
      progressText.textContent = `Scanning: ${progress.filePath}`;
    });

    try {
      await window.electronAPI.scanDirectory(selectedDirectory);
      const stats = await window.electronAPI.getStats();
      updateStats(stats);
      await loadAndRenderDbData();
      progressText.textContent = 'Scan complete!';
    } catch (error) {
      console.error('Scan failed:', error);
      progressText.textContent = `Error: ${error.message}`;
    } finally {
      scanBtn.disabled = false;
      selectDirBtn.disabled = false;
    }
  });

  function updateStats(stats) {
    tracksCountEl.textContent = stats.tracks;
    artistsCountEl.textContent = stats.artists;
    albumsCountEl.textContent = stats.albums;
  }

  async function loadInitialStats() {
    const stats = await window.electronAPI.getStats();
    updateStats(stats);
    await loadAndRenderDbData();
  }

  async function loadAndRenderDbData() {
    const data = await window.electronAPI.getAllDbData();
    renderDbData(data);
  }

  function renderDbData(data) {
    artistsListEl.innerHTML = ''; // Clear existing artists list

    // Group tracks by artist and then by album
    const groupedData = data.tracks.reduce((acc, track) => {
        if (!acc[track.artist]) {
            acc[track.artist] = {};
        }
        if (!acc[track.artist][track.album]) {
            acc[track.artist][track.album] = [];
        }
        acc[track.artist][track.album].push(track);
        return acc;
    }, {});

    // Render Artists, Albums, and Tracks in a tree structure
    for (const artistName in groupedData) {
        const artistItem = createTreeItem(artistName, 'artist');
        artistsListEl.appendChild(artistItem); // Append to artistsListEl

        const albumsList = document.createElement('ul');
        albumsList.classList.add('nested');
        artistItem.appendChild(albumsList);

        for (const albumName in groupedData[artistName]) {
            const albumItem = createTreeItem(`${albumName} (${artistName})`, 'album');
            albumsList.appendChild(albumItem);

            const tracksList = document.createElement('ul');
            tracksList.classList.add('nested');
            albumItem.appendChild(tracksList);

            groupedData[artistName][albumName].forEach(track => {
                // Pass the full track object to createTreeItem for tags
                const trackItem = createTreeItem(track.title, 'track', track);
                tracksList.appendChild(trackItem);
            });
        }
    }
  }

  function createTreeItem(text, type, trackData = null) { // Added trackData parameter
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = text;
    span.classList.add('caret'); // For styling the expand/collapse icon
    li.appendChild(span);

    if (type === 'track' && trackData) {
        li.classList.add('track-item'); // Add class for track items
        // Store tags as a data attribute, assuming trackData.tags is an array
        if (trackData.tags && Array.isArray(trackData.tags)) {
            li.dataset.tags = JSON.stringify(trackData.tags);
        } else {
            li.dataset.tags = JSON.stringify([]); // Default to empty array if no tags
        }
    }

    // Add click listener for expand/collapse
    span.addEventListener('click', function() {
        const nestedList = this.parentElement.querySelector('.nested');
        if (nestedList) { // Only toggle if there's a nested list
            nestedList.classList.toggle('active');
            this.classList.toggle('caret-down');
        }
    });

    return li;
  }

  // Add event listeners for track items to show/hide tooltip
  document.addEventListener('mouseover', function(event) {
    const target = event.target.closest('.track-item');
    if (target) {
      const tagsString = target.dataset.tags;
      let tags = [];
      if (tagsString) {
        tags = JSON.parse(tagsString);
      }
      // Always show the tooltip, even if tags array is empty
      showTagTooltip(tags, event.clientX, event.clientY);
    }
  });

  document.addEventListener('mouseout', function(event) {
    const target = event.target.closest('.track-item');
    if (target) {
      hideTagTooltip();
    }
  });

  let tagTooltip = null; // Global variable to hold the tooltip element

  function showTagTooltip(tags, x, y) {
    if (tagTooltip) {
      hideTagTooltip(); // Hide any existing tooltip
    }

    tagTooltip = document.createElement('div');
    tagTooltip.classList.add('tag-tooltip');

    // Display "No tags" if the tags array is empty
    if (tags.length > 0) {
      tagTooltip.innerHTML = `<strong>Tags:</strong> ${tags.join(', ')}`;
    } else {
      tagTooltip.innerHTML = `<strong>Tags:</strong> No tags found`;
    }

    tagTooltip.style.left = `${x + 10}px`; // Offset from mouse
    tagTooltip.style.top = `${y + 10}px`;
    document.body.appendChild(tagTooltip);
  }

  function hideTagTooltip() {
    if (tagTooltip) {
      tagTooltip.remove();
      tagTooltip = null;
    }
  }

  loadInitialStats();
});
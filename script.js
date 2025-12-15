        const STORIES_PER_PAGE = 10;
        const MAX_STORIES = 500;
        const UPDATE_INTERVAL = 60000;
        const COMMENTS_PER_BATCH = 5;
        const MAX_INITIAL_DEPTH = 2;
        
        let storyIds = [];
        let currentIndex = 0;
        let currentStoryType = 'topstories';
        let currentStoryId = null;
        let currentView = 'stories-view';
        let updateIntervals = [];
        let allCommentIds = [];
        let loadedCommentCount = 0;
        let isLoadingComments = false;

        // Routing with History API
        function getRouteFromView(viewId, params = {}) {
            switch(viewId) {
                case 'stories-view':
                    return `/${currentStoryType}`;
                case 'story-detail-view':
                    return `/story/${params.storyId}`;
                case 'user-profile-view':
                    return `/user/${params.username}`;
                default:
                    return '/';
            }
        }

        function parseRoute() {
            const path = window.location.pathname;
            
            if (path === '/' || path.startsWith('/topstories') || path.startsWith('/beststories') || path.startsWith('/newstories')) {
                const type = path === '/' ? 'topstories' : path.substring(1);
                if (['topstories', 'beststories', 'newstories'].includes(type)) {
                    currentStoryType = type;
                    updateActiveNav();
                }
                return { view: 'stories-view' };
            }
            
            if (path.startsWith('/story/')) {
                const storyId = path.substring(7);
                return { view: 'story-detail-view', storyId };
            }
            
            if (path.startsWith('/user/')) {
                const username = path.substring(6);
                return { view: 'user-profile-view', username };
            }
            
            return { view: 'stories-view' };
        }

        function updateActiveNav() {
            navButtons.forEach(btn => {
                if (btn.getAttribute('data-type') === currentStoryType) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }

        // View management
        function showView(viewId, params = {}, addToHistory = true) {
            currentView = viewId;
            document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
            document.getElementById(viewId).classList.add('active');
            
            const nav = document.getElementById('main-nav');
            nav.style.display = viewId === 'stories-view' ? 'flex' : 'none';
            
            updateIntervals.forEach(interval => clearInterval(interval));
            updateIntervals = [];

            // Update URL
            if (addToHistory) {
                const url = getRouteFromView(viewId, params);
                window.history.pushState({ view: viewId, params }, '', url);
            }
        }

        // Handle browser back/forward
        window.addEventListener('popstate', (event) => {
            if (event.state) {
                const { view, params } = event.state;
                handleRoute(view, params, false);
            } else {
                const route = parseRoute();
                handleRoute(route.view, route, false);
            }
        });

        function handleRoute(viewId, params = {}, addToHistory = true) {
            switch(viewId) {
                case 'stories-view':
                    showView('stories-view', {}, addToHistory);
                    if (storyIds.length === 0) {
                        fetchTopStoryIds();
                    }
                    break;
                case 'story-detail-view':
                    if (params.storyId) {
                        showStoryDetail(params.storyId, addToHistory);
                    }
                    break;
                case 'user-profile-view':
                    if (params.username) {
                        showUserProfile(params.username, addToHistory);
                    }
                    break;
            }
        }

        document.getElementById('header-title').addEventListener('click', (e) => {
            e.preventDefault();
            showView('stories-view');
        });

        const navButtons = document.querySelectorAll('nav button');
        navButtons.forEach(button => {
            button.addEventListener('click', () => {
                const storyType = button.getAttribute('data-type');
                if (storyType !== currentStoryType) {
                    currentStoryType = storyType;
                    updateActiveNav();
                    resetAndFetchStories();
                    const url = `/${currentStoryType}`;
                    window.history.pushState({ view: 'stories-view' }, '', url);
                }
            });
        });

        function resetAndFetchStories() {
            storyIds = [];
            currentIndex = 0;
            document.getElementById('stories').innerHTML = '';
            document.getElementById('load-more-container').classList.add('hidden');
            document.getElementById('end-message').classList.add('hidden');
            fetchTopStoryIds();
        }

        async function fetchTopStoryIds() {
            try {
                const response = await fetch(`https://hacker-news.firebaseio.com/v0/${currentStoryType}.json`);
                const ids = await response.json();
                storyIds = ids.slice(0, MAX_STORIES);
                await loadStories(false);
            } catch (error) {
                console.error('Error fetching story IDs:', error);
            }
        }

        async function loadStories(isLoadingMore) {
            const loadMoreBtn = document.getElementById('load-more-btn');
            
            if (isLoadingMore) {
                loadMoreBtn.disabled = true;
                loadMoreBtn.innerHTML = '<span class="spinner"></span> <span style="margin-left: 0.5rem;">Carregant...</span>';
            }

            const startIndex = currentIndex;
            const endIndex = Math.min(currentIndex + STORIES_PER_PAGE, storyIds.length);
            const idsToFetch = storyIds.slice(startIndex, endIndex);

            try {
                const storyPromises = idsToFetch.map(id =>
                    fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(res => res.json())
                );
                const stories = await Promise.all(storyPromises);
                
                const storiesContainer = document.getElementById('stories');
                
                stories.forEach((story, index) => {
                    const storyElement = createStoryElement(story, startIndex + index + 1);
                    storiesContainer.appendChild(storyElement);
                });

                currentIndex = endIndex;
                updateLoadMoreButton();
                
            } catch (error) {
                console.error('Error loading stories:', error);
            }
        }

        function createStoryElement(story, number) {
            const article = document.createElement('article');
            article.className = 'story';
            article.dataset.storyId = story.id;
            article.addEventListener('click', (e) => {
                e.preventDefault();
                showStoryDetail(story.id);
            });
            
            const formattedDate = formatDate(story.time);
            const commentCount = story.descendants || 0;
            
            article.innerHTML = `
                <div class="story-number">${number}.</div>
                <div class="story-content">
                    <div class="story-title">${story.title}</div>
                    <div class="story-meta">
                        <span class="score">${story.score} punts</span>
                        <span>per <span class="link author">${story.by}</span></span>
                        <span class="date">${formattedDate}</span>
                        <span class="comments">${commentCount} comentaris</span>
                    </div>
                </div>
            `;
            
            return article;
        }

        function formatDate(timestamp) {
            const date = new Date(timestamp * 1000);
            return date.toLocaleString('ca-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        function updateLoadMoreButton() {
            const loadMoreContainer = document.getElementById('load-more-container');
            const loadMoreBtn = document.getElementById('load-more-btn');
            const endMessage = document.getElementById('end-message');
            
            if (currentIndex >= Math.min(storyIds.length, MAX_STORIES)) {
                loadMoreContainer.classList.add('hidden');
                endMessage.classList.remove('hidden');
            } else {
                loadMoreContainer.classList.remove('hidden');
                loadMoreBtn.disabled = false;
                loadMoreBtn.innerHTML = `Carrega'n més`;
            }
        }

        // Story Detail with lazy loading comments
        async function showStoryDetail(storyId, addToHistory = true) {
            currentStoryId = storyId;
            showView('story-detail-view', { storyId }, addToHistory);
            
            const content = document.getElementById('story-detail-content');
            content.innerHTML = '<div class="loading"><span class="spinner spinner-dark"></span> Carregant story...</div>';

            await loadStoryDetail(storyId);
            
            const updateInterval = setInterval(() => updateStoryDetail(storyId), UPDATE_INTERVAL);
            updateIntervals.push(updateInterval);
        }

        async function loadStoryDetail(storyId) {
            try {
                const response = await fetch(`https://hacker-news.firebaseio.com/v0/item/${storyId}.json`);
                const story = await response.json();

                const formattedDate = formatDate(story.time);
                const commentCount = story.descendants || 0;

                const content = document.getElementById('story-detail-content');
                content.innerHTML = `
                    <div class="story-detail">
                        <h2>${story.title}</h2>
                        ${story.url ? `<div class="story-url">URL: <a href="${story.url}" target="_blank" rel="noopener noreferrer">${story.url}</a></div>` : ''}
                        <div class="story-detail-meta">
                            <span class="score">${story.score} punts</span>
                            <span>per <span class="author-link" data-author="${story.by}">${story.by}</span></span>
                            <span class="date">${formattedDate}</span>
                            <span class="comments-count">${commentCount} comentaris</span>
                        </div>
                        ${story.text ? `<div class="story-text">${story.text}</div>` : ''}
                    </div>
                    <div class="comments-section">
                        <div class="comments-title">Comentaris</div>
                        <div id="comments-container"></div>
                    </div>
                `;

                const authorLink = content.querySelector('.author-link');
                authorLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    showUserProfile(story.by);
                });

                if (story.kids && story.kids.length > 0) {
                    allCommentIds = story.kids;
                    loadedCommentCount = 0;
                    await loadCommentsLazy();
                    setupInfiniteScrollForComments();
                } else {
                    document.getElementById('comments-container').innerHTML = '<p class="comment-deleted">No hi ha comentaris</p>';
                }

            } catch (error) {
                console.error('Error loading story:', error);
                document.getElementById('story-detail-content').innerHTML = '<div class="loading">Error al carregar la story</div>';
            }
        }

        async function loadCommentsLazy() {
            if (isLoadingComments || loadedCommentCount >= allCommentIds.length) return;
            
            isLoadingComments = true;
            const container = document.getElementById('comments-container');
            
            // Show loading indicator
            let loadingIndicator = container.querySelector('.loading-more-comments');
            if (!loadingIndicator) {
                loadingIndicator = document.createElement('div');
                loadingIndicator.className = 'loading-more-comments';
                loadingIndicator.innerHTML = '<span class="spinner spinner-dark"></span> Carregant més comentaris...';
                container.appendChild(loadingIndicator);
            }

            const endIndex = Math.min(loadedCommentCount + COMMENTS_PER_BATCH, allCommentIds.length);
            const commentIdsToLoad = allCommentIds.slice(loadedCommentCount, endIndex);

            for (const commentId of commentIdsToLoad) {
                const commentElement = await createCommentElement(commentId, 0);
                if (commentElement) {
                    container.insertBefore(commentElement, loadingIndicator);
                }
            }

            loadedCommentCount = endIndex;

            if (loadedCommentCount >= allCommentIds.length) {
                loadingIndicator.remove();
            }

            isLoadingComments = false;
        }

        function setupInfiniteScrollForComments() {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && !isLoadingComments) {
                        loadCommentsLazy();
                    }
                });
            }, { rootMargin: '200px' });

            const checkForLoadingIndicator = setInterval(() => {
                const loadingIndicator = document.querySelector('.loading-more-comments');
                if (loadingIndicator) {
                    observer.observe(loadingIndicator);
                    clearInterval(checkForLoadingIndicator);
                }
            }, 100);

            setTimeout(() => clearInterval(checkForLoadingIndicator), 5000);
        }

        async function createCommentElement(commentId, level = 0) {
            try {
                const response = await fetch(`https://hacker-news.firebaseio.com/v0/item/${commentId}.json`);
                const comment = await response.json();

                if (!comment || comment.deleted || comment.dead) {
                    const div = document.createElement('div');
                    div.className = 'comment';
                    div.innerHTML = '<p class="comment-deleted">[comentari eliminat]</p>';
                    return div;
                }

                const div = document.createElement('div');
                div.className = 'comment';
                div.dataset.commentId = commentId;

                const formattedDate = formatDate(comment.time);

                div.innerHTML = `
                    <div class="comment-header">
                        <span class="comment-author" data-author="${comment.by}">${comment.by}</span>
                        <span> • ${formattedDate}</span>
                    </div>
                    <div class="comment-text">${comment.text || ''}</div>
                    ${comment.kids && comment.kids.length > 0 ? '<div class="comment-replies"></div>' : ''}
                `;

                const authorElement = div.querySelector('.comment-author');
                authorElement.addEventListener('click', (e) => {
                    e.preventDefault();
                    showUserProfile(comment.by);
                });

                if (comment.kids && comment.kids.length > 0) {
                    const repliesContainer = div.querySelector('.comment-replies');
                    
                    if (level < MAX_INITIAL_DEPTH) {
                        // Load first 2 levels automatically
                        for (const kidId of comment.kids) {
                            const replyElement = await createCommentElement(kidId, level + 1);
                            if (replyElement) {
                                repliesContainer.appendChild(replyElement);
                            }
                        }
                    } else {
                        // Show "Load more replies" button for deeper levels
                        const loadButton = document.createElement('button');
                        loadButton.className = 'load-more-replies-btn';
                        loadButton.innerHTML = `Veure ${comment.kids.length} ${comment.kids.length === 1 ? 'resposta' : 'respostes'}`;
                        loadButton.dataset.kids = JSON.stringify(comment.kids);
                        loadButton.dataset.level = level + 1;
                        
                        loadButton.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            loadButton.disabled = true;
                            loadButton.innerHTML = '<span class="spinner spinner-dark"></span> Carregant...';
                            
                            const kids = JSON.parse(loadButton.dataset.kids);
                            const newLevel = parseInt(loadButton.dataset.level);
                            
                            for (const kidId of kids) {
                                const replyElement = await createCommentElement(kidId, newLevel);
                                if (replyElement) {
                                    repliesContainer.insertBefore(replyElement, loadButton);
                                }
                            }
                            
                            loadButton.remove();
                        });
                        
                        repliesContainer.appendChild(loadButton);
                    }
                }

                return div;

            } catch (error) {
                console.error('Error loading comment:', error);
                return null;
            }
        }

        async function updateStoryDetail(storyId) {
            if (currentView !== 'story-detail-view') return;
            
            showUpdatingIndicator();
            
            try {
                const response = await fetch(`https://hacker-news.firebaseio.com/v0/item/${storyId}.json`);
                const story = await response.json();

                const scoreElement = document.querySelector('.story-detail .score');
                if (scoreElement) {
                    scoreElement.textContent = `${story.score} punts`;
                }

                const commentsCountElement = document.querySelector('.comments-count');
                if (commentsCountElement) {
                    commentsCountElement.textContent = `${story.descendants || 0} comentaris`;
                }

            } catch (error) {
                console.error('Error updating story:', error);
            }
            
            hideUpdatingIndicator();
        }

        // User Profile
        async function showUserProfile(username, addToHistory = true) {
            showView('user-profile-view', { username }, addToHistory);
            
            const content = document.getElementById('user-profile-content');
            content.innerHTML = '<div class="loading"><span class="spinner spinner-dark"></span> Carregant perfil...</div>';

            await loadUserProfile(username);
            
            const updateInterval = setInterval(() => updateUserProfile(username), UPDATE_INTERVAL);
            updateIntervals.push(updateInterval);
        }

        async function loadUserProfile(username) {
            try {
                const response = await fetch(`https://hacker-news.firebaseio.com/v0/user/${username}.json`);
                const user = await response.json();

                const createdDate = new Date(user.created * 1000).toLocaleDateString('ca-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });

                const content = document.getElementById('user-profile-content');
                content.innerHTML = `
                    <div class="user-profile">
                        <h2>${user.id}</h2>
                        <div class="user-info">
                            <div class="user-info-item">
                                <span class="user-info-label">Karma:</span>
                                <span class="user-info-value karma">${user.karma}</span>
                            </div>
                            <div class="user-info-item">
                                <span class="user-info-label">Registrat:</span>
                                <span class="user-info-value">${createdDate}</span>
                            </div>
                        </div>
                        ${user.about ? `
                            <div class="user-about-title">Sobre:</div>
                            <div class="user-about">${user.about}</div>
                        ` : ''}
                    </div>
                `;
            } catch (error) {
                console.error('Error loading user profile:', error);
                document.getElementById('user-profile-content').innerHTML = '<div class="loading">Error al carregar el perfil</div>';
            }
        }

        async function updateUserProfile(username) {
            if (currentView !== 'user-profile-view') return;
            
            showUpdatingIndicator();
            
            try {
                const response = await fetch(`https://hacker-news.firebaseio.com/v0/user/${username}.json`);
                const user = await response.json();

                const karmaElement = document.querySelector('.user-profile .karma');
                if (karmaElement) {
                    karmaElement.textContent = user.karma;
                }

            } catch (error) {
                console.error('Error updating user profile:', error);
            }
            
            hideUpdatingIndicator();
        }

        function showUpdatingIndicator() {
            document.getElementById('updating-indicator').classList.remove('hidden');
        }

        function hideUpdatingIndicator() {
            setTimeout(() => {
                document.getElementById('updating-indicator').classList.add('hidden');
            }, 500);
        }

        document.getElementById('back-to-stories').addEventListener('click', (e) => {
            e.preventDefault();
            showView('stories-view');
        });

        document.getElementById('back-to-previous').addEventListener('click', (e) => {
            e.preventDefault();
            if (currentStoryId) {
                showStoryDetail(currentStoryId);
            } else {
                showView('stories-view');
            }
        });

        document.getElementById('load-more-btn').addEventListener('click', () => {
            loadStories(true);
        });

        // Initialize app based on current URL
        const initialRoute = parseRoute();
        handleRoute(initialRoute.view, initialRoute, false);
        
        // Set initial history state
        const initialUrl = getRouteFromView(initialRoute.view, initialRoute);
        window.history.replaceState({ view: initialRoute.view, params: initialRoute }, '', initialUrl);
        
        if (initialRoute.view === 'stories-view') {
            fetchTopStoryIds();
        }
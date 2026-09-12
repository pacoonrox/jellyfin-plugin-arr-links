(function () {
    'use strict';

    const pluginId = '__PLUGIN_ID__';
    const state = {
        config: null,
        itemCache: new Map(),
        patched: false
    };

    function apiClient() {
        return window.ApiClient || window.ApiClientFactory?.getCurrentClient?.();
    }

    function toast(message) {
        if (window.Dashboard?.alert) {
            window.Dashboard.alert(message);
            return;
        }

        console.warn('[Arr Links]', message);
    }

    function normalizeBaseUrl(url) {
        url = String(url || '').trim();
        while (url.endsWith('/')) {
            url = url.slice(0, -1);
        }

        return url;
    }

    function loadConfig() {
        if (state.config) {
            return Promise.resolve(state.config);
        }

        const client = apiClient();
        if (!client?.getPluginConfiguration) {
            return Promise.resolve({});
        }

        return client.getPluginConfiguration(pluginId).then(config => {
            state.config = config || {};
            return state.config;
        }).catch(() => ({}));
    }

    function providerId(item, keys) {
        const providerIds = item?.ProviderIds || {};
        for (const key of keys) {
            if (providerIds[key]) {
                return providerIds[key];
            }
        }

        return '';
    }

    function getRadarrTerm(item) {
        const tmdbId = providerId(item, ['Tmdb', 'TMDb', 'TheMovieDb']);
        if (tmdbId) {
            return `tmdb:${tmdbId}`;
        }

        const imdbId = providerId(item, ['Imdb', 'IMDb']);
        if (imdbId) {
            return `imdb:${imdbId}`;
        }

        return item?.OriginalTitle || item?.Name || '';
    }

    function getSonarrTerm(item) {
        const tvdbId = providerId(item, ['Tvdb', 'TVDb']);
        if (tvdbId) {
            return `tvdb:${tvdbId}`;
        }

        const tmdbId = providerId(item, ['Tmdb', 'TMDb', 'TheMovieDb']);
        if (tmdbId) {
            return `tmdb:${tmdbId}`;
        }

        const imdbId = providerId(item, ['Imdb', 'IMDb']);
        if (imdbId) {
            return `imdb:${imdbId}`;
        }

        return item?.OriginalTitle || item?.Name || '';
    }

    function getSeriesId(item) {
        if (item?.Type === 'Series') {
            return item.Id;
        }

        return item?.SeriesId || '';
    }

    function getSeriesItem(item) {
        const seriesId = getSeriesId(item);
        if (!seriesId || seriesId === item?.Id) {
            return Promise.resolve(item);
        }

        const client = apiClient();
        if (!client?.getItem) {
            return Promise.resolve(item);
        }

        return client.getItem(client.getCurrentUserId(), seriesId).catch(() => item);
    }

    function slugify(value) {
        let slug = String(value || '')
            .toLowerCase()
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-');

        while (slug.startsWith('-')) {
            slug = slug.slice(1);
        }

        while (slug.endsWith('-')) {
            slug = slug.slice(0, -1);
        }

        return slug;
    }

    function getSeriesGraphUrl(item) {
        const tmdbId = providerId(item, ['Tmdb', 'TMDb', 'TheMovieDb']);
        if (!tmdbId) {
            return 'https://seriesgraph.com/';
        }

        const slug = slugify(item?.OriginalTitle || item?.Name || '');
        return `https://seriesgraph.com/show/${tmdbId}${slug ? '-' + slug : ''}`;
    }

    function getMovieRatingsUrl(item) {
        const imdbId = providerId(item, ['Imdb', 'IMDb']);
        if (imdbId) {
            return `https://www.imdb.com/title/${imdbId}/ratings/`;
        }

        const tmdbId = providerId(item, ['Tmdb', 'TMDb', 'TheMovieDb']);
        if (tmdbId) {
            return `https://www.themoviedb.org/movie/${tmdbId}`;
        }

        return 'https://www.imdb.com/';
    }

    function openUrl(url) {
        window.open(url, '_blank', 'noopener,noreferrer');
    }

    function openManager(item, manager) {
        return loadConfig().then(config => {
            const isRadarr = manager === 'radarr';
            const baseUrl = normalizeBaseUrl(isRadarr ? config.RadarrUrl : config.SonarrUrl);
            if (!baseUrl) {
                toast(`${isRadarr ? 'Radarr' : 'Sonarr'} URL is not configured`);
                return;
            }

            const itemPromise = isRadarr ? Promise.resolve(item) : getSeriesItem(item);
            return itemPromise.then(managerItem => {
                const term = isRadarr ? getRadarrTerm(managerItem) : getSonarrTerm(managerItem);
                openUrl(`${baseUrl}/add/new?term=${encodeURIComponent(term)}`);
            });
        });
    }

    function openSeriesGraph(item) {
        return getSeriesItem(item).then(seriesItem => openUrl(getSeriesGraphUrl(seriesItem)));
    }

    function getItemIdFromElement(element) {
        const card = element?.closest?.('[data-id], .card');
        return card?.getAttribute?.('data-id') || card?.dataset?.id || '';
    }

    function loadItemById(itemId) {
        if (!itemId) {
            return Promise.resolve(null);
        }

        if (state.itemCache.has(itemId)) {
            return Promise.resolve(state.itemCache.get(itemId));
        }

        const client = apiClient();
        if (!client?.getItem) {
            return Promise.resolve(null);
        }

        return client.getItem(client.getCurrentUserId(), itemId).then(item => {
            state.itemCache.set(itemId, item);
            return item;
        }).catch(() => null);
    }

    function buildActions(item, config) {
        const actions = [];
        if (item?.Type === 'Movie') {
            actions.push({ id: 'arrlinks-radarr', label: 'Open in Radarr', icon: 'movie' });
            if (config.MovieRatingsEnabled !== false) {
                actions.push({ id: 'arrlinks-movie-ratings', label: 'Open Movie Ratings', icon: 'bar_chart' });
            }
        }

        if (['Series', 'Season', 'Episode'].includes(item?.Type)) {
            actions.push({ id: 'arrlinks-sonarr', label: 'Open in Sonarr', icon: 'tv' });
            if (config.SeriesGraphEnabled !== false) {
                actions.push({ id: 'arrlinks-series-graph', label: 'Open Series Graph', icon: 'bar_chart' });
            }
        }

        return actions;
    }

    function handleAction(actionId, item) {
        if (actionId === 'arrlinks-radarr') {
            return openManager(item, 'radarr');
        }

        if (actionId === 'arrlinks-sonarr') {
            return openManager(item, 'sonarr');
        }

        if (actionId === 'arrlinks-series-graph') {
            return openSeriesGraph(item);
        }

        if (actionId === 'arrlinks-movie-ratings') {
            openUrl(getMovieRatingsUrl(item));
        }

        return Promise.resolve();
    }

    function ensureMenu() {
        let menu = document.querySelector('.arrlinks-menu');
        if (menu) {
            return menu;
        }

        menu = document.createElement('div');
        menu.className = 'arrlinks-menu';
        menu.style.cssText = 'position:fixed;z-index:999999;min-width:13rem;background:#202020;color:#fff;border:1px solid rgba(255,255,255,.18);box-shadow:0 10px 30px rgba(0,0,0,.45);border-radius:4px;padding:.35rem 0;font-family:inherit;';
        document.body.appendChild(menu);
        return menu;
    }

    function hideMenu() {
        document.querySelector('.arrlinks-menu')?.remove();
    }

    function showMenu(event, item, actions) {
        const menu = ensureMenu();
        menu.innerHTML = '';
        for (const action of actions) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = action.label;
            button.dataset.action = action.id;
            button.style.cssText = 'display:block;width:100%;padding:.75rem 1rem;background:transparent;border:0;color:inherit;text-align:left;font:inherit;cursor:pointer;';
            button.addEventListener('mouseenter', () => { button.style.background = 'rgba(255,255,255,.1)'; });
            button.addEventListener('mouseleave', () => { button.style.background = 'transparent'; });
            button.addEventListener('click', () => {
                hideMenu();
                handleAction(action.id, item);
            });
            menu.appendChild(button);
        }

        menu.style.left = `${Math.min(event.clientX, window.innerWidth - 230)}px`;
        menu.style.top = `${Math.min(event.clientY, window.innerHeight - (actions.length * 48 + 16))}px`;
    }

    function onContextMenu(event) {
        const itemId = getItemIdFromElement(event.target);
        if (!itemId) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        Promise.all([loadConfig(), loadItemById(itemId)]).then(([config, item]) => {
            const actions = buildActions(item, config);
            if (!actions.length) {
                return;
            }

            showMenu(event, item, actions);
        });
    }

    function patch() {
        if (state.patched) {
            return;
        }

        state.patched = true;
        document.addEventListener('contextmenu', onContextMenu, true);
        document.addEventListener('click', hideMenu, true);
        document.addEventListener('scroll', hideMenu, true);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', patch, { once: true });
    } else {
        patch();
    }
}());

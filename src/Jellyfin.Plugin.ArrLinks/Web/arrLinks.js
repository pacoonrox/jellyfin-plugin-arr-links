(function () {
    'use strict';

    const pluginId = '__PLUGIN_ID__';
    const state = {
        config: null,
        itemCache: new Map(),
        pendingItem: null,
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

    function closeActionSheet(button) {
        const sheet = button.closest('.actionSheet');
        sheet?.querySelector('.btnCloseActionSheet')?.click();
    }

    function createActionButton(action, item) {
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('is', 'emby-button');
        button.className = 'listItem listItem-button actionSheetMenuItem arrlinks-action';
        button.dataset.id = action.id;

        const icon = document.createElement('span');
        icon.className = `actionsheetMenuItemIcon listItemIcon listItemIcon-transparent material-icons ${action.icon}`;
        icon.setAttribute('aria-hidden', 'true');

        const body = document.createElement('div');
        body.className = 'listItemBody actionsheetListItemBody';

        const text = document.createElement('div');
        text.className = 'listItemBodyText actionSheetItemText';
        text.textContent = action.label;

        body.appendChild(text);
        button.appendChild(icon);
        button.appendChild(body);
        button.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            closeActionSheet(button);
            handleAction(action.id, item);
        }, true);

        return button;
    }

    function injectIntoOpenSheets() {
        const item = state.pendingItem;
        if (!item) {
            return;
        }

        document.querySelectorAll('.actionSheet').forEach(sheet => {
            const scroller = sheet.querySelector('.actionSheetScroller');
            if (!scroller || scroller.querySelector('.arrlinks-action')) {
                return;
            }

            Promise.all([loadConfig(), Promise.resolve(item)]).then(([config, loadedItem]) => {
                const actions = buildActions(loadedItem, config);
                if (!actions.length || scroller.querySelector('.arrlinks-action')) {
                    return;
                }

                const divider = document.createElement('div');
                divider.className = 'actionsheetDivider arrlinks-action';
                const insertBefore = scroller.querySelector('.actionsheetDivider:not(.arrlinks-action)')?.nextSibling || scroller.firstChild;
                scroller.insertBefore(divider, insertBefore);

                actions.forEach(action => {
                    scroller.insertBefore(createActionButton(action, loadedItem), insertBefore);
                });
            });
        });
    }

    function rememberTarget(target) {
        const itemId = getItemIdFromElement(target);
        if (!itemId) {
            return;
        }

        loadItemById(itemId).then(item => {
            if (item) {
                state.pendingItem = item;
                injectIntoOpenSheets();
            }
        });
    }

    function patch() {
        if (state.patched) {
            return;
        }

        state.patched = true;
        document.documentElement.dataset.arrLinksPlugin = '0.1.6';
        console.info('[Arr Links] Web actions loaded');
        document.addEventListener('contextmenu', event => rememberTarget(event.target), true);
        document.addEventListener('click', event => {
            const menuButton = event.target?.closest?.('[data-action="menu"], .btnCardOptions, .btnMoreCommands, .btnMore');
            if (menuButton) {
                rememberTarget(menuButton);
            }
        }, true);

        new MutationObserver(injectIntoOpenSheets).observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', patch, { once: true });
    } else {
        patch();
    }
}());

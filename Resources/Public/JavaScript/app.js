/**
 * nk_google_map: Google Maps with clustered markers (no dependencies besides
 * @googlemaps/markerclusterer, see Contrib/).
 *
 * Every ".gmap-canvas-container[data-gmap-config]" is initialised when it
 * becomes visible. Markers come from the configuration, from "requestUri"
 * (one request) or from "streamUri" (page by page).
 *
 * Events (dispatched on the container):
 *   nkgmap:ready   detail: { id, map }
 *   nkgmap:filter  detail: { id, type, value }
 */
(() => {
  'use strict';

  const MAP_STYLE = [{"elementType":"geometry","stylers":[{"color":"#f5f5f5"}]},{"elementType":"labels.icon","stylers":[{"visibility":"off"}]},{"elementType":"labels.text.fill","stylers":[{"color":"#616161"}]},{"elementType":"labels.text.stroke","stylers":[{"color":"#f5f5f5"}]},{"featureType":"administrative.land_parcel","elementType":"labels.text.fill","stylers":[{"color":"#bdbdbd"}]},{"featureType":"landscape.man_made","elementType":"geometry.fill","stylers":[{"color":"#92b1cc"},{"lightness":30}]},{"featureType":"landscape.natural","elementType":"geometry.fill","stylers":[{"color":"#93b1cc"},{"lightness":80}]},{"featureType":"landscape.natural.landcover","elementType":"geometry.fill","stylers":[{"color":"#93b1cc"},{"lightness":70}]},{"featureType":"landscape.natural.terrain","elementType":"geometry.fill","stylers":[{"color":"#93b1cc"},{"lightness":60}]},{"featureType":"poi","elementType":"geometry","stylers":[{"color":"#eeeeee"}]},{"featureType":"poi","elementType":"labels.text.fill","stylers":[{"color":"#757575"}]},{"featureType":"poi.business","elementType":"geometry.fill","stylers":[{"color":"#93b1cc"}]},{"featureType":"poi.government","elementType":"geometry.fill","stylers":[{"color":"#93b1cc"}]},{"featureType":"poi.medical","elementType":"geometry.fill","stylers":[{"color":"#93b1cc"}]},{"featureType":"poi.park","elementType":"geometry","stylers":[{"color":"#e5e5e5"}]},{"featureType":"poi.park","elementType":"geometry.fill","stylers":[{"color":"#93b1cc"},{"lightness":10}]},{"featureType":"poi.park","elementType":"labels.text.fill","stylers":[{"color":"#9e9e9e"}]},{"featureType":"poi.place_of_worship","elementType":"geometry.fill","stylers":[{"color":"#93b1cc"},{"saturation":-100},{"lightness":-100}]},{"featureType":"poi.school","elementType":"geometry.fill","stylers":[{"color":"#93b1cc"}]},{"featureType":"poi.sports_complex","elementType":"geometry.fill","stylers":[{"color":"#93b1cc"},{"lightness":10}]},{"featureType":"road","elementType":"geometry","stylers":[{"color":"#ffffff"}]},{"featureType":"road.arterial","elementType":"labels.text.fill","stylers":[{"color":"#757575"}]},{"featureType":"road.highway","elementType":"geometry","stylers":[{"color":"#dadada"}]},{"featureType":"road.highway","elementType":"labels.text.fill","stylers":[{"color":"#616161"}]},{"featureType":"road.local","elementType":"labels.text.fill","stylers":[{"color":"#9e9e9e"}]},{"featureType":"transit.line","elementType":"geometry","stylers":[{"color":"#92b1cc"}]},{"featureType":"transit.station","elementType":"geometry","stylers":[{"color":"#eeeeee"}]},{"featureType":"water","elementType":"geometry","stylers":[{"color":"#c9c9c9"}]},{"featureType":"water","elementType":"geometry.fill","stylers":[{"color":"#93b1cc"},{"lightness":-10}]},{"featureType":"water","elementType":"labels.text.fill","stylers":[{"color":"#ffffff"}]}];

  const CLUSTER_ICONS = {
    heterogen: 'heterogen.svg',
    'digital-heterogen': 'heterogen_digital.svg',
    'event-church_service': 'event_gottesdienst.svg',
    'event-edu': 'event_bildung.svg',
    'event-committee': 'event_gremien.svg',
    'event-event': 'event_gemeindeleben.svg',
    'event-leisure': 'event_freizeit.svg',
    'event-music': 'event_konzerte.svg',
    'event-spirituality': 'event_spiritualitaet.svg',
    'event-base': 'event_gemeindeleben.svg',
    'digital-event-church_service': 'event_digital-gottesdienst.svg',
    'digital-event-edu': 'event_digital-bildung.svg',
    'digital-event-committee': 'event_digital-gremien.svg',
    'digital-event-event': 'event_digital-gemeindeleben.svg',
    'digital-event-leisure': 'event_digital-freizeit.svg',
    'digital-event-music': 'event_digital-konzerte.svg',
    'digital-event-spirituality': 'event_digital-spiritualitaet.svg',
    'digital-event-base': 'event_digital-gemeindeleben.svg',
    'institution-4': 'inst_kirchengemeinde.svg',
    'institution-6': 'inst_friedhof.svg',
    'institution-9': 'inst_kirche.svg',
    'institution-11': 'inst_kita.svg',
    'institution-12': 'inst_kirchenkreis.svg',
    'institution-16': 'inst_synode.svg',
    'institution-22': 'inst_diakonie.svg',
    'institution-31': 'inst_kirchenamt.svg',
    'institution-33': 'inst_kirchenbuero.svg',
    'institution-35': 'inst_bischof.svg',
    'institution-37': 'inst_kirchenleitung.svg',
    'institution-42': 'inst_kirchenamt.svg',
    'institution-65': 'inst_tagungshaus.svg',
    'institution-122': 'inst_pfadfinder.svg',
  };

  const BADGE_COLOR = '#850057';
  const STREAM_DELAY = 200;
  const CLUSTER_INFO_MAX_MARKERS = 20;
  const CLUSTER_INFO_MAX_SPREAD = 0.0003;
  const AUTO_CENTER_MAX_MARKERS = 500;

  let apiPromise = null;

  /**
   * Loads the Google Maps API once (unless the site loads it itself)
   */
  const loadGoogleMaps = (config) => {
    if (window.google?.maps?.importLibrary) {
      return Promise.resolve();
    }
    if (apiPromise) {
      return apiPromise;
    }
    if (!config.loadApi || !config.apiKey) {
      apiPromise = new Promise((resolve, reject) => {
        // The site loads the API itself: wait for it
        let attempts = 0;
        const timer = window.setInterval(() => {
          if (window.google?.maps?.importLibrary || window.google?.maps?.Map) {
            window.clearInterval(timer);
            resolve();
          } else if (++attempts > 100) {
            window.clearInterval(timer);
            reject(new Error('Google Maps API not available (no API key configured)'));
          }
        }, 100);
      });
      return apiPromise;
    }
    apiPromise = new Promise((resolve, reject) => {
      const callback = '__nkGoogleMapLoaded';
      window[callback] = () => resolve();
      const script = document.createElement('script');
      script.src = 'https://maps.googleapis.com/maps/api/js?' + new URLSearchParams({
        key: config.apiKey,
        loading: 'async',
        callback,
      });
      script.async = true;
      script.onerror = () => reject(new Error('Google Maps API could not be loaded'));
      document.head.append(script);
    });
    return apiPromise;
  };

  const addQueryParameter = (url, name, value) => url + (url.includes('?') ? '&' : '?') + encodeURIComponent(name) + '=' + encodeURIComponent(value);

  const fetchJson = async (url) => {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
    if (!response.ok) {
      throw new Error('HTTP ' + response.status + ' for ' + url);
    }
    return response.json();
  };

  /**
   * Marker types are space separated tokens, e.g. "event-music" or "digital-event-music".
   * The filter value "event-music" matches both.
   */
  const matchesFilter = (type, value) => !value || type.split(' ').some((token) => token === value || token.endsWith('-' + value));

  const COUNT_PATTERN = /\s*\(\d+\)$/;

  class GoogleMap {
    constructor(container, config) {
      this.container = container;
      this.config = config;
      this.markers = [];
      this.markerData = new WeakMap();
      this.bounds = null;
      this.map = null;
      this.clusterer = null;
      this.infoWindow = null;
      this.requestId = String(Math.floor(Math.random() * 1e9));
      this.fitted = false;
    }

    async init() {
      await loadGoogleMaps(this.config);
      const { Map, InfoWindow } = await google.maps.importLibrary('maps');
      this.advanced = Boolean(this.config.mapId);
      if (this.advanced) {
        this.AdvancedMarkerElement = (await google.maps.importLibrary('marker')).AdvancedMarkerElement;
      }

      const options = {
        center: { lat: this.config.defaultCenter.lat, lng: this.config.defaultCenter.lon },
        zoom: this.config.zoom.initial,
        disableDoubleClickZoom: true,
        keyboardShortcuts: true,
        scrollwheel: true,
      };
      if (this.advanced) {
        options.mapId = this.config.mapId;
      } else {
        options.styles = MAP_STYLE;
      }

      this.map = new Map(this.container.querySelector('.map'), options);
      this.infoWindow = new InfoWindow({ maxWidth: 400 });
      this.bounds = new google.maps.LatLngBounds();
      this.clusterer = new markerClusterer.MarkerClusterer({
        map: this.map,
        algorithm: new markerClusterer.SuperClusterAlgorithm({ radius: 60 }),
        renderer: { render: (cluster) => this.renderCluster(cluster) },
        // Clicks are bound in renderCluster(): the clusterer still uses addListener(),
        // which Google deprecates for advanced markers
        onClusterClick: null,
      });

      this.bindFitOnClick();

      if (this.config.markers.length) {
        this.addMarkers(this.config.markers);
        this.fit();
      } else if (this.config.streamUri) {
        await this.loadStream(1);
      } else if (this.config.requestUri) {
        await this.loadAll();
      }

      this.hideOverlay();
      this.container.dispatchEvent(new CustomEvent('nkgmap:ready', { bubbles: true, detail: { id: this.config.id, map: this.map } }));
    }

    async loadAll() {
      try {
        const result = await fetchJson(this.config.requestUri);
        this.addMarkers(result?.data ?? []);
        this.fit();
      } catch (error) {
        console.error('[nk_google_map]', error);
      }
    }

    async loadStream(page) {
      let url = addQueryParameter(this.config.streamUri, this.config.pagination || 'page', page);
      if (this.config.requestId) {
        url = addQueryParameter(url, this.config.requestId, this.requestId);
      }
      try {
        const result = await fetchJson(url);
        const data = result?.data ?? [];
        this.addMarkers(data);
        if (page === 1 || !this.fitted) {
          this.fit();
        }
        // Older endpoints mark a complete result by "crdate"
        const complete = result?.complete ?? Boolean(result?.crdate);
        if (data.length > 0 && !complete) {
          await new Promise((resolve) => window.setTimeout(resolve, STREAM_DELAY));
          await this.loadStream(page + 1);
        } else if (page > 1) {
          // All pages loaded: show all markers
          this.fit();
        }
      } catch (error) {
        console.error('[nk_google_map]', error);
      }
    }

    addMarkers(pointsOfInterest) {
      const created = pointsOfInterest
        .filter((poi) => Number.isFinite(parseFloat(poi.lat)) && Number.isFinite(parseFloat(poi.lon)))
        .map((poi) => this.createMarker(poi));
      this.markers.push(...created);
      this.clusterer.addMarkers(created);
      this.updateFilterCounts();
    }

    /**
     * Counts in the filter options ("Konzerte (12)") from the markers on the map.
     * The server counts all objects, including those without coordinates.
     */
    updateFilterCounts() {
      const id = CSS.escape(String(this.config.id));
      const types = this.markers.map((marker) => this.markerData.get(marker).type);
      const count = (value) => types.filter((type) => matchesFilter(type, value)).length;

      document.querySelectorAll('select.map-filter[data-gmap-id="' + id + '"] option').forEach((option) => {
        if (option.value && COUNT_PATTERN.test(option.text)) {
          const number = count(option.value);
          option.text = option.text.replace(COUNT_PATTERN, ' (' + number + ')');
          option.hidden = number === 0;
        }
      });
      document.querySelectorAll('ul.form-field--map-filter[data-gmap-id="' + id + '"] li[data-value]').forEach((item) => {
        const link = item.querySelector('a') || item;
        if (item.dataset.value && COUNT_PATTERN.test(link.textContent)) {
          const number = count(item.dataset.value);
          link.textContent = link.textContent.replace(COUNT_PATTERN, ' (' + number + ')');
          if (item.dataset.caption) {
            item.dataset.caption = item.dataset.caption.replace(COUNT_PATTERN, ' (' + number + ')');
          }
          item.hidden = number === 0;
        }
      });
    }

    createMarker(poi) {
      const position = { lat: parseFloat(poi.lat), lng: parseFloat(poi.lon) };
      let marker;
      if (this.advanced) {
        const icon = document.createElement('img');
        icon.src = poi.icon;
        icon.width = 32;
        icon.height = 38;
        icon.alt = '';
        marker = new this.AdvancedMarkerElement({ position, content: icon, title: poi.title || '', gmpClickable: true });
      } else {
        marker = new google.maps.Marker({ position, icon: poi.icon || undefined, title: poi.title || '' });
      }
      this.markerData.set(marker, {
        type: String(poi.type || ''),
        info: poi.info || '',
        object: poi.info ? '' : (poi.object + ':' + poi.id),
        visible: true,
      });
      this.bounds.extend(position);
      this.onClick(marker, () => this.openInfo([marker], position));
      return marker;
    }

    onClick(marker, callback) {
      if (this.advanced) {
        marker.addEventListener('gmp-click', callback);
      } else {
        marker.addListener('click', callback);
      }
    }

    async openInfo(markers, position) {
      this.infoWindow.close();
      this.infoWindow.setPosition(position);
      const inline = markers.map((marker) => this.markerData.get(marker).info).filter(Boolean);
      const objects = markers.map((marker) => this.markerData.get(marker).object).filter(Boolean);

      if (objects.length === 0) {
        this.infoWindow.setContent(inline.join(''));
        this.infoWindow.open({ map: this.map });
        return;
      }

      this.infoWindow.setContent('Lade …');
      this.infoWindow.open({ map: this.map });
      try {
        const response = await fetch(addQueryParameter(this.config.markerInfoUri, 'items', objects.join(',')), { credentials: 'same-origin' });
        this.infoWindow.setContent(inline.join('') + (response.ok ? await response.text() : ''));
      } catch (error) {
        console.error('[nk_google_map]', error);
        this.infoWindow.close();
      }
    }

    onClusterClick(cluster) {
      const bounds = cluster.bounds;
      const spread = bounds
        ? Math.max(
          Math.abs(bounds.getNorthEast().lat() - bounds.getSouthWest().lat()),
          Math.abs(bounds.getNorthEast().lng() - bounds.getSouthWest().lng()),
        )
        : 0;
      // Markers at (almost) the same place: show their info instead of zooming
      if (spread <= CLUSTER_INFO_MAX_SPREAD && (cluster.markers.length <= CLUSTER_INFO_MAX_MARKERS || spread === 0)) {
        this.openInfo(cluster.markers, cluster.position);
        return;
      }
      if (bounds) {
        this.map.fitBounds(bounds);
      }
    }

    /**
     * Icon of the cluster: the marker type if all markers share it, otherwise
     * the "heterogen" icon (or its digital variant)
     */
    clusterIcon(markers) {
      const types = new Set(markers.map((marker) => this.markerData.get(marker).type));
      if (types.size === 1) {
        const [type] = types;
        if (CLUSTER_ICONS[type]) {
          return this.config.iconBase + CLUSTER_ICONS[type];
        }
      }
      const digital = [...types].every((type) => type.startsWith('digital'));
      return this.config.iconBase + CLUSTER_ICONS[digital ? 'digital-heterogen' : 'heterogen'];
    }

    renderCluster(cluster) {
      const icon = this.clusterIcon(cluster.markers);
      const count = String(cluster.count);
      // Clusters above single markers, bigger clusters on top
      const zIndex = 1000000 + cluster.count;

      if (this.advanced) {
        const element = document.createElement('div');
        element.className = 'gmap-cluster';
        element.style.cssText = 'position:relative;width:40px;height:47px';
        const image = document.createElement('img');
        image.src = icon;
        image.width = 40;
        image.height = 47;
        image.alt = '';
        const badge = document.createElement('span');
        badge.className = 'gmap-cluster-badge';
        badge.textContent = count;
        badge.style.cssText = 'position:absolute;top:-6px;right:-8px;min-width:22px;height:22px;padding:0 4px;border-radius:11px;'
          + 'background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.35);color:' + BADGE_COLOR + ';font:bold 12px/22px sans-serif;text-align:center;box-sizing:border-box';
        element.append(image, badge);
        const advancedMarker = new this.AdvancedMarkerElement({ position: cluster.position, content: element, zIndex, title: count, gmpClickable: true });
        this.onClick(advancedMarker, () => this.onClusterClick(cluster));
        return advancedMarker;
      }

      const marker = new google.maps.Marker({
        position: cluster.position,
        zIndex,
        title: count,
        icon: { url: icon, scaledSize: new google.maps.Size(40, 47), labelOrigin: new google.maps.Point(34, 6) },
        // White circle via CSS class (see _CSS_DEFAULT_STYLE)
        label: { text: count, color: BADGE_COLOR, fontSize: '12px', fontWeight: 'bold', className: 'gmap-cluster-badge' },
      });
      this.onClick(marker, () => this.onClusterClick(cluster));
      return marker;
    }

    filter(value) {
      const visible = [];
      this.markers.forEach((marker) => {
        const data = this.markerData.get(marker);
        data.visible = matchesFilter(data.type, value);
        if (data.visible) {
          visible.push(marker);
        }
      });
      this.infoWindow.close();
      this.clusterer.clearMarkers();
      this.clusterer.addMarkers(visible);
    }

    fit() {
      if (this.bounds.isEmpty()) {
        return;
      }
      google.maps.event.trigger(this.map, 'resize');
      this.map.fitBounds(this.bounds);
      this.fitted = true;

      const center = this.config.center;
      let fixedCenter = null;
      if (center.mode === 'fixed') {
        fixedCenter = { lat: center.lat, lng: center.lon };
      } else if (center.mode === 'user' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => this.map.setCenter({ lat: position.coords.latitude, lng: position.coords.longitude }),
          () => {},
        );
      } else if (this.markers.length > AUTO_CENTER_MAX_MARKERS) {
        fixedCenter = { lat: this.config.defaultCenter.lat, lng: this.config.defaultCenter.lon };
      }
      const centerMoved = fixedCenter !== null || center.mode === 'user';

      // Vector maps apply fitBounds() asynchronously: center and zoom only after it is done
      google.maps.event.addListenerOnce(this.map, 'idle', () => {
        const zoom = this.map.getZoom();
        if (zoom > this.config.zoom.max) {
          this.map.setZoom(this.config.zoom.max);
        } else if (centerMoved && zoom < this.config.zoom.min) {
          // Only with a given center: on the marker bounds a higher zoom would cut off markers
          this.map.setZoom(this.config.zoom.min);
        }
        if (fixedCenter) {
          this.map.setCenter(fixedCenter);
        }
      });
    }

    /**
     * Maps in hidden areas (e.g. tabs) are fitted when the given element is clicked
     */
    bindFitOnClick() {
      if (!this.config.fitOnClick) {
        return;
      }
      document.querySelectorAll(this.config.fitOnClick).forEach((element) => {
        element.addEventListener('click', () => window.setTimeout(() => this.fit(), 50), { once: true });
      });
    }

    hideOverlay() {
      const overlay = this.container.querySelector('.overlay');
      if (overlay) {
        overlay.hidden = true;
      }
    }
  }

  const maps = new Map();

  const readConfig = (container) => {
    try {
      return JSON.parse(container.dataset.gmapConfig || '{}');
    } catch (error) {
      console.error('[nk_google_map] invalid configuration', error);
      return null;
    }
  };

  const initMap = (container) => {
    const config = readConfig(container);
    if (!config || maps.has(config.id)) {
      return;
    }
    const map = new GoogleMap(container, config);
    maps.set(config.id, map);
    map.init().catch((error) => console.error('[nk_google_map]', error));
  };

  /**
   * Filter by facet: <select class="map-filter" data-gmap-id data-type> or
   * theme lists <ul class="form-field--map-filter" data-gmap-id data-type><li data-value>
   */
  const applyFilter = (id, type, value, source) => {
    document.querySelectorAll('select.map-filter[data-gmap-id="' + CSS.escape(id) + '"]').forEach((select) => {
      if (select !== source && select.dataset.type !== type) {
        select.value = '';
      }
    });
    maps.get(id)?.filter(value);
    document.querySelector('.gmap-canvas-container[data-gmap-id="' + CSS.escape(id) + '"]')
      ?.dispatchEvent(new CustomEvent('nkgmap:filter', { bubbles: true, detail: { id, type, value } }));
  };

  document.addEventListener('change', (event) => {
    const select = event.target.closest?.('select.map-filter');
    if (select) {
      applyFilter(select.dataset.gmapId, select.dataset.type, select.value, select);
    }
  });

  document.addEventListener('click', (event) => {
    const item = event.target.closest?.('ul.form-field--map-filter li');
    if (item) {
      event.preventDefault();
      const list = item.closest('ul.form-field--map-filter');
      applyFilter(list.dataset.gmapId, list.dataset.type, item.dataset.value || '', list);
    }
  });

  const start = () => {
    const containers = document.querySelectorAll('.gmap-canvas-container[data-gmap-config]');
    if (!('IntersectionObserver' in window)) {
      containers.forEach(initMap);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          observer.unobserve(entry.target);
          initMap(entry.target);
        }
      });
    }, { threshold: 0.1 });
    containers.forEach((container) => observer.observe(container));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();

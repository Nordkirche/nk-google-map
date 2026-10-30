# TYPO3 Extension nk_google_map

Stellt einen ViewHelper bereit, der Marker – optional geclustert und filterbar – in
einer Google-Karte darstellt. Wird von nkc_address und nkc_event verwendet.

## Voraussetzungen

* TYPO3 13.4 LTS oder 14.3 LTS, PHP 8.2 bis 8.5
* Ein Google Maps API Key, optional eine Map-ID

## Installation

    composer req nordkirche/nk-google-map

Site Set **Google Maps (Nordkirche)** (`nordkirche/nk-google-map`) einbinden oder das
statische TypoScript-Template. Einstellungen (Site Settings bzw. TypoScript-Konstanten):

| Einstellung | Bedeutung |
| --- | --- |
| `plugin.tx_nkgooglemap_pi1.googleMapsApiKey` | Google Maps API Key |
| `plugin.tx_nkgooglemap_pi1.googleMapsMapId` | Map-ID. Mit Map-ID werden „Advanced Markers“ verwendet, der Kartenstil kommt dann aus der Google Cloud Console. Ohne Map-ID: klassische Marker mit dem mitgelieferten Kartenstil |
| `plugin.tx_nkgooglemap_pi1.googleMapsApi` | Google-API laden (abschalten, wenn die Website sie selbst lädt) |

Die Google-API wird erst geladen, wenn eine Karte sichtbar wird. Die Extension braucht
kein jQuery mehr.

## Der ViewHelper

    {namespace nkg=Nordkirche\NkGoogleMap\ViewHelpers}

    <nkg:googleMap markers="{markers}" configuration="{style: 'height: 400px'}" />
    <nkg:googleMap requestUri="{dataUri}" />
    <nkg:googleMap streamUri="{pageUri}" configuration="{pagination: 'tx_ext_plugin[page]'}" />

| Argument | Bedeutung |
| --- | --- |
| `markers` | Marker-Array (kein Nachladen) |
| `requestUri` | JSON-Endpunkt, der alle Marker liefert |
| `streamUri` | JSON-Endpunkt, der die Marker seitenweise liefert (Parameter aus `configuration.pagination`, optional `configuration.requestId`) |
| `configuration` | `iconBasePath`, `style`, `cssClass`, `center` (1 = fest mit `lat`/`lon`, 2 = Standort des Nutzers, sonst automatisch), `facets`, `header`, `header_layout` |
| `fitOnClick` | CSS-Selektor; Klick darauf passt die Karte an (z. B. für Karten in Tabs) |
| `markerInfoUri` | URL für Info-Fenster, Standard `{Site-Basis}marker` (siehe nkc_base, Marker-Info-Provider) |

### Marker und Endpunkte

    {
      "data": [
        {"lat": 54.3, "lon": 10.1, "icon": "/_assets/.../inst_kita.svg", "title": "…", "type": "institution-11",
         "object": "i", "id": 123}
      ],
      "complete": true
    }

Ein Marker hat entweder `info` (HTML des Info-Fensters) oder `object` + `id`; dann wird das
Info-Fenster über `markerInfoUri?items=i:123,p:45` geladen. Beim Streaming wird so lange
die nächste Seite geladen, bis `complete` gesetzt ist oder keine Marker mehr kommen.

### Filter

Werden `facets` übergeben, rendert das Template `<select class="map-filter">`-Felder.
Eigene Templates können auch Listen `<ul class="form-field--map-filter" data-gmap-id data-type>`
mit `<li data-value>` verwenden. Nach jeder Filterung wird am Karten-Container das Event
`nkgmap:filter` ausgelöst (z. B. für eigene Select-Plugins), nach dem Laden `nkgmap:ready`.

### Cluster

Die Anzahl der Marker eines Clusters steht in einem weißen Kreis (Klasse `gmap-cluster-badge`).
Das Standard-CSS dafür kommt über `plugin.tx_nkgooglemap_pi1._CSS_DEFAULT_STYLE`. Wer es im Theme
entfernt, muss `.gmap-cluster-badge` selbst gestalten. Mit Map-ID (Advanced Markers) ist der Kreis
direkt im Element gestaltet.

## Upgrade auf Version 13

* Die Konfiguration wird als `data-gmap-config`-Attribut ausgegeben, nicht mehr als
  Inline-Script (`gmapConfig`). Eigene `Index.html`-Overrides müssen das Attribut übernehmen
  und dürfen `{jsCode}` nicht mehr verwenden.
* jQuery wird nicht mehr benötigt; die Konstante `jquery` entfällt.
* Die Middleware für Info-Fenster (`/marker`) liegt jetzt in nkc_base.
* Der Cache `tx_nkgooglemaps` und die Fluid-Widget-Klassen wurden entfernt.

## Tests

    composer install
    composer test:unit
    composer test:functional    # SQLite, keine Datenbank nötig

Die Functional Tests laufen gegen TYPO3 13.4 und 14.3 (testing-framework ^9.2).

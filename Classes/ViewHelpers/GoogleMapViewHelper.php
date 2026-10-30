<?php

declare(strict_types=1);

namespace Nordkirche\NkGoogleMap\ViewHelpers;

use Psr\Http\Message\ServerRequestInterface;
use TYPO3\CMS\Core\Site\Entity\Site;
use TYPO3\CMS\Core\Site\Entity\SiteLanguage;
use TYPO3\CMS\Core\SystemResource\Publishing\SystemResourcePublisherInterface;
use TYPO3\CMS\Core\SystemResource\SystemResourceFactory;
use TYPO3\CMS\Core\TypoScript\FrontendTypoScript;
use TYPO3\CMS\Core\Utility\GeneralUtility;
use TYPO3\CMS\Core\Utility\PathUtility;
use TYPO3\CMS\Core\View\ViewFactoryData;
use TYPO3\CMS\Core\View\ViewFactoryInterface;
use TYPO3Fluid\Fluid\Core\ViewHelper\AbstractViewHelper;

/**
 * Renders a Google Map. Markers are passed directly or loaded from a JSON endpoint.
 *
 * <nkg:googleMap markers="{markers}" />
 * <nkg:googleMap requestUri="{dataUri}" configuration="{facets: facets}" />
 * <nkg:googleMap streamUri="{paginatedDataUri}" configuration="{pagination: 'tx_x_y[page]'}" />
 *
 * Endpoint response: {"data": [{"lat", "lon", "icon", "title", "type", "info" | "object" + "id"}], "complete": true}
 * Info windows of markers without "info" are loaded from "{site base}marker?items=object:id,..."
 */
class GoogleMapViewHelper extends AbstractViewHelper
{
    private const DEFAULT_PATHS = [
        'templateRootPaths' => ['EXT:nk_google_map/Resources/Private/Templates/'],
        'partialRootPaths' => ['EXT:nk_google_map/Resources/Private/Partials/'],
        'layoutRootPaths' => ['EXT:nk_google_map/Resources/Private/Layouts/'],
    ];

    /**
     * @var bool
     */
    protected $escapeOutput = false;

    public function __construct(private readonly ViewFactoryInterface $viewFactory) {}

    public function initializeArguments(): void
    {
        $this->registerArgument('requestUri', 'string', 'URI of a JSON endpoint delivering all markers', false, '');
        $this->registerArgument('streamUri', 'string', 'URI of a JSON endpoint delivering the markers page by page', false, '');
        $this->registerArgument('markers', 'array', 'Markers', false, []);
        $this->registerArgument('configuration', 'array', 'Configuration (center, lat, lon, facets, pagination, requestId, iconBasePath, style, cssClass, header, ...)', false, []);
        $this->registerArgument('fitOnClick', 'string', 'CSS selector: fit the map when this element is clicked (e.g. a tab)', false, '');
        $this->registerArgument('markerInfoUri', 'string', 'URI for info windows, defaults to "{site base}marker"', false, '');
    }

    public function render(): string
    {
        $request = $this->getRequest();
        $typoScript = $this->getTypoScript($request);
        $settings = (array)($typoScript['settings'] ?? []);

        $configuration = array_merge(['iconBasePath' => 'EXT:nkc_base/Resources/Public/MapIcons/', 'style' => ''], (array)$this->arguments['configuration']);
        $mapId = 'gmap-' . bin2hex(random_bytes(6));

        $view = $this->viewFactory->create(new ViewFactoryData(
            templateRootPaths: $this->getPaths($typoScript, 'templateRootPaths'),
            partialRootPaths: $this->getPaths($typoScript, 'partialRootPaths'),
            layoutRootPaths: $this->getPaths($typoScript, 'layoutRootPaths'),
            request: $request,
        ));
        $view->assignMultiple([
            'mapId' => $mapId,
            'configuration' => $configuration,
            'settings' => $settings,
            'requestUri' => $this->arguments['requestUri'],
            'streamUri' => $this->arguments['streamUri'],
            'fitOnClick' => $this->arguments['fitOnClick'],
            'clientConfiguration' => json_encode(
                $this->buildClientConfiguration($mapId, $configuration, $settings, $request),
                JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
            ),
        ]);
        return $view->render('Index');
    }

    /**
     * Configuration for app.js, rendered as data attribute (no inline script)
     */
    private function buildClientConfiguration(string $mapId, array $configuration, array $settings, ?ServerRequestInterface $request): array
    {
        $center = ['mode' => 'auto'];
        if ((string)($configuration['center'] ?? '') === '1') {
            $center = ['mode' => 'fixed', 'lat' => (float)($configuration['lat'] ?? 0), 'lon' => (float)($configuration['lon'] ?? 0)];
        } elseif ((string)($configuration['center'] ?? '') === '2') {
            $center = ['mode' => 'user'];
        }

        return [
            'id' => $mapId,
            'markers' => array_values((array)$this->arguments['markers']),
            'requestUri' => (string)$this->arguments['requestUri'],
            'streamUri' => (string)$this->arguments['streamUri'],
            'pagination' => (string)($configuration['pagination'] ?? ''),
            'requestId' => (string)($configuration['requestId'] ?? ''),
            'markerInfoUri' => (string)$this->arguments['markerInfoUri'] ?: $this->getDefaultMarkerInfoUri($request),
            'center' => $center,
            'fitOnClick' => (string)$this->arguments['fitOnClick'],
            'iconBase' => $this->getPublicPath((string)$configuration['iconBasePath'], $request),
            'apiKey' => (string)($settings['apiKey'] ?? ''),
            'mapId' => (string)($settings['mapId'] ?? ''),
            'loadApi' => (bool)($settings['loadApi'] ?? true),
            'defaultCenter' => [
                'lat' => (float)($settings['defaultCenter']['lat'] ?? 54.136244),
                'lon' => (float)($settings['defaultCenter']['lon'] ?? 10.409546),
            ],
            'zoom' => [
                'initial' => (int)($settings['zoom']['initial'] ?? 8),
                'min' => (int)($settings['zoom']['min'] ?? 9),
                'max' => (int)($settings['zoom']['max'] ?? 12),
            ],
        ];
    }

    private function getDefaultMarkerInfoUri(?ServerRequestInterface $request): string
    {
        $language = $request?->getAttribute('language');
        $site = $request?->getAttribute('site');
        $base = match (true) {
            $language instanceof SiteLanguage => $language->getBase(),
            $site instanceof Site => $site->getBase(),
            default => null,
        };
        return $base === null ? '/marker' : rtrim($base->getPath(), '/') . '/marker';
    }

    private function getPublicPath(string $path, ?ServerRequestInterface $request): string
    {
        if (!str_starts_with($path, 'EXT:')) {
            return $path;
        }
        try {
            // TYPO3 v14: system resource API
            if (interface_exists(SystemResourcePublisherInterface::class)) {
                $resource = GeneralUtility::makeInstance(SystemResourceFactory::class)->createPublicResource($path);
                $uri = (string)GeneralUtility::makeInstance(SystemResourcePublisherInterface::class)->generateUri($resource, $request);
            } else {
                $uri = PathUtility::getPublicResourceWebPath($path);
            }
        } catch (\Throwable) {
            return '';
        }
        return rtrim($uri, '/') . '/';
    }

    /**
     * @return string[]
     */
    private function getPaths(array $typoScript, string $type): array
    {
        $paths = (array)($typoScript['view'][$type] ?? []);
        ksort($paths);
        return array_values(array_filter($paths)) ?: self::DEFAULT_PATHS[$type];
    }

    /**
     * plugin.tx_nkgooglemap_pi1 as plain array
     */
    private function getTypoScript(?ServerRequestInterface $request): array
    {
        $frontendTypoScript = $request?->getAttribute('frontend.typoscript');
        if (!$frontendTypoScript instanceof FrontendTypoScript || !$frontendTypoScript->hasSetup()) {
            return [];
        }
        $setup = $frontendTypoScript->getSetupArray()['plugin.']['tx_nkgooglemap_pi1.'] ?? [];
        return is_array($setup) ? GeneralUtility::removeDotsFromTS($setup) : [];
    }

    private function getRequest(): ?ServerRequestInterface
    {
        return $this->renderingContext->hasAttribute(ServerRequestInterface::class)
            ? $this->renderingContext->getAttribute(ServerRequestInterface::class)
            : null;
    }
}

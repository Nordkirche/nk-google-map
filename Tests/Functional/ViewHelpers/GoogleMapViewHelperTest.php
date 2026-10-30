<?php

declare(strict_types=1);

namespace Nordkirche\NkGoogleMap\Tests\Functional\ViewHelpers;

use PHPUnit\Framework\Attributes\Test;
use TYPO3\CMS\Core\Core\SystemEnvironmentBuilder;
use TYPO3\CMS\Core\Http\NormalizedParams;
use TYPO3\CMS\Core\Http\ServerRequest;
use TYPO3\CMS\Core\Site\Entity\Site;
use TYPO3\CMS\Core\View\ViewFactoryData;
use TYPO3\CMS\Core\View\ViewFactoryInterface;
use TYPO3\TestingFramework\Core\Functional\FunctionalTestCase;

final class GoogleMapViewHelperTest extends FunctionalTestCase
{
    protected array $testExtensionsToLoad = [
        'nordkirche/nkc-base',
        'nordkirche/nk-google-map',
    ];

    #[Test]
    public function configurationForTheScriptIsADataAttribute(): void
    {
        [$html, $config] = $this->render([
            'markers' => ['i-1' => ['object' => 'i', 'id' => '1', 'title' => 'St. Marien', 'lat' => 54.3, 'lon' => 10.1]],
            'configuration' => ['center' => '1', 'lat' => '53.55', 'lon' => '9.99', 'cssClass' => 'wide'],
        ]);

        self::assertStringNotContainsString('<script', $html, 'No inline script (CSP)');
        self::assertMatchesRegularExpression('/^gmap-[0-9a-f]{12}$/', $config['id']);
        self::assertSame([['object' => 'i', 'id' => '1', 'title' => 'St. Marien', 'lat' => 54.3, 'lon' => 10.1]], $config['markers'], 'Markers are a list');
        self::assertSame(['mode' => 'fixed', 'lat' => 53.55, 'lon' => 9.99], $config['center']);
        self::assertSame('/de/marker', $config['markerInfoUri'], 'Info windows relative to the site base');
        self::assertStringContainsString('MapIcons/', $config['iconBase']);
        self::assertStringEndsWith('/', $config['iconBase']);
        self::assertStringContainsString('gmap-canvas-container wide', $html);
        self::assertStringNotContainsString('overlay', $html, 'No loading spinner without endpoint');
    }

    #[Test]
    public function defaultsWithoutTypoScript(): void
    {
        [, $config] = $this->render([]);

        self::assertSame(['mode' => 'auto'], $config['center']);
        self::assertSame('', $config['apiKey']);
        self::assertTrue($config['loadApi']);
        self::assertSame(['lat' => 54.136244, 'lon' => 10.409546], $config['defaultCenter']);
        self::assertSame(['initial' => 8, 'min' => 9, 'max' => 12], $config['zoom']);
        self::assertSame([], $config['markers']);
    }

    #[Test]
    public function asyncMarkersShowASpinnerAndKeepTheEndpoint(): void
    {
        [$html, $config] = $this->render([
            'requestUri' => '/karte?tx_nkcaddress_map%5Baction%5D=data&type=56282&uid=8&cHash=abc',
            'markerInfoUri' => '/custom/marker',
            'configuration' => ['center' => '2'],
        ]);

        self::assertSame('/karte?tx_nkcaddress_map%5Baction%5D=data&type=56282&uid=8&cHash=abc', $config['requestUri']);
        self::assertSame('/custom/marker', $config['markerInfoUri']);
        self::assertSame(['mode' => 'user'], $config['center']);
        self::assertStringContainsString('class="overlay"', $html);
    }

    #[Test]
    public function markerContentCannotBreakOutOfTheAttribute(): void
    {
        $title = '"><script>alert(1)</script> & \'Kirche\'';

        [$html, $config] = $this->render(['markers' => [['title' => $title, 'lat' => 54.0, 'lon' => 10.0]]]);

        self::assertStringNotContainsString('<script>', $html);
        self::assertSame($title, $config['markers'][0]['title'], 'The value arrives unchanged in the script');
    }

    /**
     * @return array{0: string, 1: array<string, mixed>}
     */
    private function render(array $variables): array
    {
        $request = new ServerRequest('https://example.org/de/karte', 'GET', null, [], ['HTTP_HOST' => 'example.org', 'HTTPS' => 'on']);
        $request = $request
            ->withAttribute('applicationType', SystemEnvironmentBuilder::REQUESTTYPE_FE)
            ->withAttribute('normalizedParams', NormalizedParams::createFromRequest($request))
            ->withAttribute('site', new Site('main', 1, ['base' => 'https://example.org/de/', 'languages' => []]));
        $view = $this->get(ViewFactoryInterface::class)->create(new ViewFactoryData(
            templatePathAndFilename: __DIR__ . '/../Fixtures/Templates/Map.html',
            request: $request,
        ));
        $view->assignMultiple($variables + ['markers' => [], 'requestUri' => '', 'configuration' => [], 'markerInfoUri' => '']);
        $html = $view->render();

        self::assertSame(1, preg_match('/data-gmap-config="([^"]*)"/', $html, $matches), 'Data attribute found');
        return [$html, json_decode(html_entity_decode($matches[1], ENT_QUOTES | ENT_HTML5), true, 512, JSON_THROW_ON_ERROR)];
    }
}

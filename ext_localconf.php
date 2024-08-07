<?php

use TYPO3\CMS\Core\Cache\Frontend\VariableFrontend;

defined('TYPO3') || die('Access denied.');

call_user_func(
    function () {
        if (!isset($GLOBALS['TYPO3_CONF_VARS']['SYS']['caching']['cacheConfigurations']['tx_nkgooglemaps']) || !is_array($GLOBALS['TYPO3_CONF_VARS']['SYS']['caching']['cacheConfigurations']['tx_nkgooglemaps'])) {
            $GLOBALS['TYPO3_CONF_VARS']['SYS']['caching']['cacheConfigurations']['tx_nkcbase'] = [];
        }

        if (!isset($GLOBALS['TYPO3_CONF_VARS']['SYS']['caching']['cacheConfigurations']['tx_nkgooglemaps']['frontend'])) {
            $GLOBALS['TYPO3_CONF_VARS']['SYS']['caching']['cacheConfigurations']['tx_nkgooglemaps'] = [
                'frontend' => VariableFrontend::class,
                'options' => [
                    'defaultLifetime' => 86400 * 2,
                ],
                'groups' => ['nk_google_map'],
            ];
        }

        $GLOBALS['TYPO3_CONF_VARS']['EXTENSIONS']['nk_google_map']['config_mapping'] = 'e:\\Nordkirche\\NkcEvent\\Controller\\EventController,p:\\Nordkirche\\NkcAddress\\Controller\\PersonController,i:\\Nordkirche\\NkcAddress\\Controller\\InstitutionController';
    }
);

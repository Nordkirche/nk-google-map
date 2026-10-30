<?php

$EM_CONF[$_EXTKEY] = [
    'title' => 'Google Maps',
    'description' => 'Karten mit Markern aus der Nordkirche API (NAPI)',
    'category' => 'plugin',
    'author' => 'netzleuchten GmbH',
    'author_email' => 'hallo@netzleuchten.com',
    'state' => 'stable',
    'version' => '13.0.0',
    'constraints' => [
        'depends' => [
            'php' => '8.2.0-8.5.99',
            'typo3' => '13.4.0-14.3.99',
        ],
        'conflicts' => [],
        'suggests' => [],
    ],
];

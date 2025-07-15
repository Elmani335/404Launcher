<?php
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
include 'php/scandir.php';

$instance_param = $_GET['instance'] ?? 'null';

if ($instance_param == '/' || (strlen($instance_param) > 0 && $instance_param[0] == '.')) {
    echo json_encode([]);
    exit;
} 

// Create instances directory if it doesn't exist
if (!file_exists('instances')) {
    mkdir('instances', 0755, true);
}

// Create specific instance directory if it doesn't exist
if ($instance_param != 'null' && !file_exists("instances/$instance_param")) {
    mkdir("instances/$instance_param", 0755, true);
}

if ($instance_param == 'null') {
    $instances_list = scanFolder("instances");
    $instance = array();
    foreach ($instances_list as $value) {
        if (substr($_SERVER['REQUEST_URI'], -1) == '/') {
            $_SERVER['REQUEST_URI'] = substr($_SERVER['REQUEST_URI'], 0, -1);
        }

        $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
        $url = "$protocol://$_SERVER[HTTP_HOST]$_SERVER[REQUEST_URI]?instance=$value";
        $instance[$value] = array("name" => $value, "url" => $url);
    }
    
    include 'php/instances.php';
    echo str_replace("\\", "", json_encode($instance));
    exit;
}

// Return empty JSON array for now to fix the immediate error
echo json_encode([]);
?>

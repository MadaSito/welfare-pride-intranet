<?php
/**
 * Plugin Name: Welfare Pride Intranet Link
 * Description: Adds a configurable, accessible link or button from WordPress to the separately hosted Welfare Pride employee intranet.
 * Version: 1.0.0
 * Requires at least: 6.0
 * Requires PHP: 8.0
 */

if (!defined('ABSPATH')) {
    exit;
}

const WELFARE_PRIDE_INTRANET_OPTION = 'welfare_pride_intranet_url';

add_action('admin_init', function () {
    register_setting('welfare_pride_intranet', WELFARE_PRIDE_INTRANET_OPTION, [
        'type' => 'string',
        'sanitize_callback' => 'esc_url_raw',
        'default' => '',
    ]);
});

add_action('admin_menu', function () {
    add_options_page(
        'Welfare Pride Intranet',
        'Welfare Pride Intranet',
        'manage_options',
        'welfare-pride-intranet',
        function () {
            if (!current_user_can('manage_options')) {
                return;
            }
            ?>
            <div class="wrap">
                <h1>Welfare Pride Intranet</h1>
                <p>Enter the standalone intranet URL, normally a protected subdomain such as <code>https://intranet.example.org</code>.</p>
                <form method="post" action="options.php">
                    <?php settings_fields('welfare_pride_intranet'); ?>
                    <table class="form-table" role="presentation">
                        <tr>
                            <th scope="row"><label for="welfare-pride-intranet-url">Intranet URL</label></th>
                            <td><input class="regular-text" id="welfare-pride-intranet-url" name="<?php echo esc_attr(WELFARE_PRIDE_INTRANET_OPTION); ?>" type="url" required value="<?php echo esc_attr(get_option(WELFARE_PRIDE_INTRANET_OPTION, '')); ?>" placeholder="https://intranet.example.org" /></td>
                        </tr>
                    </table>
                    <?php submit_button(); ?>
                </form>
                <p>Use shortcode <code>[welfare_pride_intranet_link]</code> on a WordPress page, button block, or reusable block.</p>
            </div>
            <?php
        }
    );
});

add_shortcode('welfare_pride_intranet_link', function ($attributes) {
    $attributes = shortcode_atts([
        'label' => 'Open Welfare Pride Employee Intranet',
        'class' => 'wp-element-button',
        'new_window' => 'yes',
    ], $attributes, 'welfare_pride_intranet_link');

    $url = get_option(WELFARE_PRIDE_INTRANET_OPTION, '');
    if (!$url) {
        return current_user_can('manage_options') ? '<p><strong>Welfare Pride intranet URL is not configured.</strong></p>' : '';
    }

    $target = $attributes['new_window'] === 'yes' ? ' target="_blank" rel="noopener noreferrer"' : '';
    return sprintf(
        '<a class="%1$s" href="%2$s"%3$s>%4$s</a>',
        esc_attr($attributes['class']),
        esc_url($url),
        $target,
        esc_html($attributes['label'])
    );
});

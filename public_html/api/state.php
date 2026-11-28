<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';
raspina_set_exception_handler();
raspina_send_security_headers();
raspina_start_session();

const RASPINA_STATE_ARRAYS = [
    'customers', 'transactions', 'followUps', 'rmas', 'tickets',
    'campaigns', 'familyGroups', 'giftCards', 'auditLogs',
];

function raspina_validate_state_document(mixed $state): array
{
    if (!is_array($state)) {
        raspina_fail('invalid_state', 'ساختار داده CRM معتبر نیست.', 422);
    }
    if (($state['schemaVersion'] ?? null) !== 3 && ($state['version'] ?? null) !== 3) {
        raspina_fail('invalid_state_version', 'نسخه داده CRM پشتیبانی نمی‌شود.', 422);
    }

    foreach (RASPINA_STATE_ARRAYS as $key) {
        if (!isset($state[$key]) || !is_array($state[$key])) {
            raspina_fail('invalid_state', "بخش «{$key}» در داده CRM یافت نشد.", 422);
        }
        if (count($state[$key]) > 20000) {
            raspina_fail('state_too_large', 'تعداد رکوردهای داده بیش از حد مجاز است.', 413);
        }
    }

    if (count($state['customers']) > 5000) {
        raspina_fail('state_too_large', 'تعداد مشتریان بیش از حد مجاز است.', 413);
    }

    foreach ($state['customers'] as $customer) {
        if (
            !is_array($customer) ||
            !isset($customer['id'], $customer['fullName'], $customer['phoneE164'], $customer['tierCode']) ||
            !is_string($customer['id']) ||
            !is_array($customer['orders'] ?? null) ||
            !is_array($customer['identities'] ?? null)
        ) {
            raspina_fail('invalid_customer', 'یکی از پروفایل‌های مشتری ناقص است.', 422);
        }
    }

    $state['schemaVersion'] = 3;
    return $state;
}

/** @return array<string, array> */
function raspina_index_items(array $items): array
{
    $indexed = [];
    foreach ($items as $item) {
        if (is_array($item) && isset($item['id']) && is_string($item['id'])) {
            $indexed[$item['id']] = $item;
        }
    }
    return $indexed;
}

function raspina_require_any_permission(string $role, array $permissions): bool
{
    foreach ($permissions as $permission) {
        if (raspina_has_permission($role, $permission)) {
            return true;
        }
    }
    return false;
}

/**
 * Field-level authorization for the state snapshot. The UI is not trusted:
 * every added/changed record is checked against the caller's role so an
 * authenticated read-only account cannot forge loyalty, RMA or campaign data.
 */
function raspina_assert_state_changes_allowed(array $before, array $after, string $role): void
{
    if ($role === 'ceo') {
        return;
    }

    $deny = static function (string $message, string $permission): never {
        raspina_fail(
            'forbidden_change',
            $message . ' (مجوز لازم: ' . $permission . ')',
            403
        );
    };

    $beforeCustomers = raspina_index_items($before['customers'] ?? []);
    $afterCustomers = raspina_index_items($after['customers'] ?? []);

    if (count($afterCustomers) > count($beforeCustomers) && !raspina_has_permission($role, 'customers:create')) {
        $deny('افزودن مشتری جدید مجاز نیست.', 'customers:create');
    }
    if (count($afterCustomers) < count($beforeCustomers)) {
        $deny('حذف مشتری از snapshot فقط توسط مدیرعامل مجاز است.', 'ceo');
    }

    foreach ($afterCustomers as $id => $customer) {
        $previous = $beforeCustomers[$id] ?? null;
        if ($previous === null) {
            if ((int) ($customer['pointsBalance'] ?? 0) > 100 && !raspina_has_permission($role, 'loyalty:award')) {
                $deny('موجودی اولیه امتیاز مشتری جدید بیش از حد مجاز است.', 'loyalty:award');
            }
            continue;
        }

        $coreFields = ['fullName', 'phoneE164', 'city', 'tierCode', 'annualSpendToman', 'lifetimeValueToman'];
        foreach ($coreFields as $field) {
            if (($previous[$field] ?? null) !== ($customer[$field] ?? null) && !raspina_has_permission($role, 'customers:edit')) {
                $deny('ویرایش مشخصات اصلی مشتری مجاز نیست.', 'customers:edit');
            }
        }
        if (
            ($previous['orders'] ?? null) !== ($customer['orders'] ?? null) &&
            !raspina_has_permission($role, 'integrations:simulate')
        ) {
            $deny('تغییر سفارش‌های مشتری فقط از مسیر وب‌هوک مجاز است.', 'integrations:simulate');
        }
        if (
            ($previous['identities'] ?? null) !== ($customer['identities'] ?? null) &&
            !raspina_has_permission($role, 'customers:edit')
        ) {
            $deny('تغییر هویت‌های کانال مشتری مجاز نیست.', 'customers:edit');
        }

        $beforePoints = (int) ($previous['pointsBalance'] ?? 0);
        $afterPoints = (int) ($customer['pointsBalance'] ?? 0);
        if ($afterPoints > $beforePoints && !raspina_has_permission($role, 'loyalty:award')) {
            $deny('افزایش موجودی امتیاز مجاز نیست.', 'loyalty:award');
        }
        if ($afterPoints < $beforePoints && !raspina_has_permission($role, 'loyalty:redeem')) {
            $deny('کسر موجودی امتیاز مجاز نیست.', 'loyalty:redeem');
        }

        $beforeWallet = (int) ($previous['walletBalanceToman'] ?? 0);
        $afterWallet = (int) ($customer['walletBalanceToman'] ?? 0);
        if (
            $afterWallet !== $beforeWallet &&
            !raspina_require_any_permission($role, ['loyalty:redeem', 'rma:advance', 'loyalty:award'])
        ) {
            $deny('تغییر اعتبار کیف پول مجاز نیست.', 'loyalty:redeem');
        }

        $beforeInteractions = is_array($previous['interactions'] ?? null) ? $previous['interactions'] : [];
        $afterInteractions = is_array($customer['interactions'] ?? null) ? $customer['interactions'] : [];
        if (count($afterInteractions) > count($beforeInteractions) && !raspina_has_permission($role, 'customers:edit')) {
            $deny('ثبت تعامل جدید مجاز نیست.', 'customers:edit');
        }

        $beforeTags = is_array($previous['tags'] ?? null) ? $previous['tags'] : [];
        $afterTags = is_array($customer['tags'] ?? null) ? $customer['tags'] : [];
        if ($beforeTags !== $afterTags && !raspina_has_permission($role, 'customers:edit')) {
            $deny('تغییر برچسب‌های مشتری مجاز نیست.', 'customers:edit');
        }

        if (
            (int) ($previous['npsLatest'] ?? 0) !== (int) ($customer['npsLatest'] ?? 0) &&
            !raspina_require_any_permission($role, ['followup:complete', 'customers:edit'])
        ) {
            $deny('تغییر NPS مشتری مجاز نیست.', 'followup:complete');
        }
    }

    $beforeFollowUps = raspina_index_items($before['followUps'] ?? []);
    $afterFollowUps = raspina_index_items($after['followUps'] ?? []);
    foreach ($afterFollowUps as $id => $task) {
        $previous = $beforeFollowUps[$id] ?? null;
        if ($previous === null) {
            if (!raspina_require_any_permission($role, ['integrations:simulate', 'followup:complete'])) {
                $deny('ایجاد وظیفه پیگیری مجاز نیست.', 'integrations:simulate');
            }
            continue;
        }
        if (
            ($previous['status'] ?? '') !== ($task['status'] ?? '') ||
            ($previous['npsRecorded'] ?? null) !== ($task['npsRecorded'] ?? null)
        ) {
            if (!raspina_has_permission($role, 'followup:complete')) {
                $deny('تغییر وضعیت پیگیری مجاز نیست.', 'followup:complete');
            }
        }
    }
    if (count($afterFollowUps) < count($beforeFollowUps) && !raspina_has_permission($role, 'followup:complete')) {
        $deny('حذف وظیفه پیگیری مجاز نیست.', 'followup:complete');
    }

    $beforeTickets = raspina_index_items($before['tickets'] ?? []);
    $afterTickets = raspina_index_items($after['tickets'] ?? []);
    foreach ($afterTickets as $id => $ticket) {
        $previous = $beforeTickets[$id] ?? null;
        if ($previous === null) {
            if (!raspina_has_permission($role, 'support:create')) {
                $deny('ایجاد تیکت جدید مجاز نیست.', 'support:create');
            }
            continue;
        }
        if ($previous !== $ticket && !raspina_has_permission($role, 'support:advance')) {
            $deny('تغییر تیکت مجاز نیست.', 'support:advance');
        }
    }
    if (count($afterTickets) < count($beforeTickets) && !raspina_has_permission($role, 'support:advance')) {
        $deny('حذف تیکت مجاز نیست.', 'support:advance');
    }

    $beforeRmas = raspina_index_items($before['rmas'] ?? []);
    $afterRmas = raspina_index_items($after['rmas'] ?? []);
    foreach ($afterRmas as $id => $rma) {
        $previous = $beforeRmas[$id] ?? null;
        if ($previous === null) {
            if (!raspina_has_permission($role, 'rma:create')) {
                $deny('ثبت مرجوعی جدید مجاز نیست.', 'rma:create');
            }
            continue;
        }
        if ($previous !== $rma && !raspina_has_permission($role, 'rma:advance')) {
            $deny('تغییر مرجوعی مجاز نیست.', 'rma:advance');
        }
    }
    if (count($afterRmas) < count($beforeRmas) && !raspina_has_permission($role, 'rma:advance')) {
        $deny('حذف مرجوعی مجاز نیست.', 'rma:advance');
    }

    $beforeCampaigns = raspina_index_items($before['campaigns'] ?? []);
    $afterCampaigns = raspina_index_items($after['campaigns'] ?? []);
    if (count($afterCampaigns) !== count($beforeCampaigns) && !raspina_has_permission($role, 'campaign:create')) {
        $deny('ایجاد یا حذف کمپین مجاز نیست.', 'campaign:create');
    }
    foreach ($afterCampaigns as $id => $campaign) {
        $previous = $beforeCampaigns[$id] ?? null;
        if ($previous !== null && ($previous['isActive'] ?? false) !== ($campaign['isActive'] ?? false)) {
            if (!raspina_has_permission($role, 'campaign:toggle')) {
                $deny('فعال یا متوقف کردن کمپین مجاز نیست.', 'campaign:toggle');
            }
        }
        if ($previous !== null) {
            $previousToggleOnly = $previous;
            $campaignToggleOnly = $campaign;
            unset($previousToggleOnly['isActive'], $campaignToggleOnly['isActive']);
            if ($previousToggleOnly !== $campaignToggleOnly && !raspina_has_permission($role, 'campaign:create')) {
                $deny('ویرایش محتوای کمپین مجاز نیست.', 'campaign:create');
            }
        }
    }

    $beforeGiftCards = raspina_index_items($before['giftCards'] ?? []);
    $afterGiftCards = raspina_index_items($after['giftCards'] ?? []);
    if (count($afterGiftCards) > count($beforeGiftCards) && !raspina_has_permission($role, 'loyalty:giftcard')) {
        $deny('صدور کارت هدیه مجاز نیست.', 'loyalty:giftcard');
    }
    if (count($afterGiftCards) < count($beforeGiftCards)) {
        $deny('حذف کارت هدیه مجاز نیست.', 'ceo');
    }
    foreach ($afterGiftCards as $id => $card) {
        if (isset($beforeGiftCards[$id]) && $beforeGiftCards[$id] !== $card && !raspina_has_permission($role, 'loyalty:giftcard')) {
            $deny('تغییر کارت هدیه مجاز نیست.', 'loyalty:giftcard');
        }
    }

    $beforeFamilies = raspina_index_items($before['familyGroups'] ?? []);
    $afterFamilies = raspina_index_items($after['familyGroups'] ?? []);
    if ($beforeFamilies !== $afterFamilies && !raspina_has_permission($role, 'customers:edit')) {
        $deny('تغییر گروه‌های خانوادگی مجاز نیست.', 'customers:edit');
    }

    $beforeTransactions = raspina_index_items($before['transactions'] ?? []);
    foreach (raspina_index_items($after['transactions'] ?? []) as $id => $tx) {
        if (isset($beforeTransactions[$id])) {
            if ($beforeTransactions[$id] !== $tx) {
                $deny('تراکنش‌های امتیاز پس از ثبت قابل ویرایش نیستند.', 'ceo');
            }
            continue;
        }
        $type = (string) ($tx['type'] ?? '');
        if ($type === 'earn') {
            $actionFa = (string) ($tx['actionFa'] ?? '');
            $isWebhook = str_contains($actionFa, 'سفارش وب‌هوک');
            $txCustomerId = (string) ($tx['customerId'] ?? '');
            // The +100 profile-completion bonus belongs to customer creation, not to
            // the loyalty-award permission, but only for a brand-new profile.
            $isNewProfileBonus = !isset($beforeCustomers[$txCustomerId])
                && str_contains($actionFa, 'تکمیل پروفایل جدید')
                && (int) ($tx['pointsDelta'] ?? 0) <= 100;
            $permission = $isWebhook
                ? 'integrations:simulate'
                : ($isNewProfileBonus ? 'customers:create' : 'loyalty:award');
            if (!raspina_has_permission($role, $permission)) {
                $deny('ثبت تراکنش امتیاز مجاز نیست.', $permission);
            }
        } elseif ($type === 'redeem' && !raspina_has_permission($role, 'loyalty:redeem')) {
            $deny('ثبت تراکنش خرج امتیاز مجاز نیست.', 'loyalty:redeem');
        }
    }
}

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

if ($method === 'GET') {
    $user = raspina_require_permission('dashboard:view');
    try {
        $stmt = raspina_db()->query('SELECT payload, version, updated_by, updated_at FROM app_state WHERE id = 1 LIMIT 1');
        $row = $stmt->fetch();
    } catch (PDOException $e) {
        error_log('Raspina state read failed: ' . $e->getCode());
        raspina_fail('setup_required', 'جدول app_state آماده نیست؛ اسکیمای دیتابیس را ایمپورت کنید.', 503);
    }

    if (!is_array($row)) {
        raspina_json([
            'ok' => true,
            'state' => null,
            'version' => 0,
            'updatedAt' => null,
            'updatedBy' => null,
        ]);
    }

    $state = json_decode((string) $row['payload'], true);
    if (!is_array($state)) {
        raspina_fail('corrupt_state', 'داده ذخیره‌شده روی سرور قابل خواندن نیست.', 500);
    }

    raspina_json([
        'ok' => true,
        'state' => $state,
        'version' => (int) $row['version'],
        'updatedAt' => $row['updated_at'],
        'updatedBy' => $row['updated_by'],
    ]);
}

if ($method !== 'PUT') {
    header('Allow: GET, PUT');
    raspina_fail('method_not_allowed', 'متد درخواست مجاز نیست.', 405);
}

$user = raspina_require_auth();
raspina_require_same_origin();
raspina_require_csrf();

$body = raspina_read_json_body();
$state = raspina_validate_state_document($body['state'] ?? null);

$ifMatch = (string) ($_SERVER['HTTP_IF_MATCH'] ?? '');
$bodyVersion = $body['version'] ?? null;
$expectedVersion = null;
if ($ifMatch !== '' && ctype_digit($ifMatch)) {
    $expectedVersion = (int) $ifMatch;
} elseif (is_int($bodyVersion) || (is_string($bodyVersion) && ctype_digit($bodyVersion))) {
    $expectedVersion = (int) $bodyVersion;
}

if ($expectedVersion === null || $expectedVersion < 0) {
    raspina_fail('version_required', 'نسخه داده برای ذخیره‌سازی الزامی است.', 428);
}

$pdo = raspina_db();
try {
    $pdo->beginTransaction();

    $stmt = $pdo->query('SELECT payload, version FROM app_state WHERE id = 1 FOR UPDATE');
    $row = $stmt->fetch();

    if (!is_array($row)) {
        if ($expectedVersion !== 0) {
            $pdo->rollBack();
            raspina_fail('version_conflict', 'نسخه داده روی سرور وجود ندارد؛ صفحه را دوباره بارگذاری کنید.', 409);
        }
        $previousState = [
            'customers' => [], 'transactions' => [], 'followUps' => [], 'rmas' => [],
            'tickets' => [], 'campaigns' => [], 'familyGroups' => [], 'giftCards' => [], 'auditLogs' => [],
        ];
        $currentVersion = 0;
    } else {
        $currentVersion = (int) $row['version'];
        $decoded = json_decode((string) $row['payload'], true);
        $previousState = is_array($decoded) ? $decoded : [];
        if ($currentVersion !== $expectedVersion) {
            $pdo->rollBack();
            raspina_fail('version_conflict', 'نسخه داده تغییر کرده است؛ صفحه را دوباره بارگذاری کنید.', 409);
        }
    }

    raspina_assert_state_changes_allowed($previousState, $state, (string) $user['role']);

    // Audit trail is server-owned: client-supplied entries are discarded so a
    // compromised or curious account cannot forge or erase the history.
    $deltaLabels = [
        'customers' => 'مشتری', 'followUps' => 'پیگیری', 'tickets' => 'تیکت',
        'rmas' => 'مرجوعی', 'campaigns' => 'کمپین', 'giftCards' => 'کارت هدیه',
        'transactions' => 'تراکنش',
    ];
    $changes = [];
    foreach ($deltaLabels as $key => $label) {
        $beforeItems = raspina_index_items($previousState[$key] ?? []);
        $afterItems = raspina_index_items($state[$key] ?? []);
        $added = array_diff_key($afterItems, $beforeItems);
        if ($added === []) {
            continue;
        }
        $names = [];
        foreach (array_slice($added, 0, 3, true) as $item) {
            $name = $item['fullName'] ?? $item['subject'] ?? $item['titleFa'] ?? $item['title'] ?? $item['code'] ?? '';
            if (is_string($name) && $name !== '') {
                $names[] = $name;
            }
        }
        $changes[] = $label . ' +' . count($added) . ($names !== [] ? ' (' . implode('، ', $names) . ')' : '');
    }
    $serverAuditEntry = [
        'id' => 'aud-' . bin2hex(random_bytes(8)),
        'actorRole' => (string) $user['role'],
        'action' => mb_substr(
            'ذخیره تغییرات پنل (نسخه ' . $nextVersion . ')' . ($changes !== [] ? ': ' . implode('؛ ', $changes) : ''),
            0,
            240
        ),
        'target' => mb_substr((string) $user['username'], 0, 120),
        'timestamp' => gmdate('c'),
    ];
    $previousAudit = is_array($previousState['auditLogs'] ?? null) ? $previousState['auditLogs'] : [];
    $state['auditLogs'] = array_slice(array_merge([$serverAuditEntry], $previousAudit), 0, 200);

    $encoded = json_encode($state, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($encoded === false || strlen($encoded) > RASPINA_MAX_JSON_BYTES) {
        $pdo->rollBack();
        raspina_fail('state_too_large', 'حجم داده CRM بیش از حد مجاز است.', 413);
    }

    $nextVersion = $currentVersion + 1;
    if (!is_array($row)) {
        $insert = $pdo->prepare(
            'INSERT INTO app_state (id, payload, version, updated_by, updated_at)
             VALUES (1, :payload, :version, :updated_by, NOW())'
        );
        $insert->execute([
            ':payload' => $encoded,
            ':version' => $nextVersion,
            ':updated_by' => $user['username'],
        ]);
    } else {
        $update = $pdo->prepare(
            'UPDATE app_state SET payload = :payload, version = :version, updated_by = :updated_by, updated_at = NOW()
             WHERE id = 1'
        );
        $update->execute([
            ':payload' => $encoded,
            ':version' => $nextVersion,
            ':updated_by' => $user['username'],
        ]);
    }

    raspina_audit(
        'ذخیره snapshot CRM (نسخه ' . $nextVersion . ')',
        $user['username'],
        (string) $user['role']
    );

    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    if ($e instanceof PDOException) {
        error_log('Raspina state write failed: ' . $e->getCode());
        raspina_fail('state_write_failed', 'ذخیره‌سازی داده روی سرور انجام نشد.', 500);
    }
    throw $e;
}

raspina_json([
    'ok' => true,
    'version' => $nextVersion,
    'updatedAt' => gmdate('c'),
]);

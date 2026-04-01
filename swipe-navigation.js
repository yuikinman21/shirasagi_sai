// swipe-navigation.js
// 左端からの右スワイプで「検索画面 → ホーム画面」へ戻る機能を構築する。
// スマホのみ

(function () {    
    // ------------------------------
    // 設定値
    // ------------------------------

    // スマホ判定。既存仕様に合わせて 767px 以下のみ有効。
    const MOBILE_QUERY = '(max-width: 767px)';
    
    // これ以上右へ動いたら「戻る」を確定する閾値。
    const SWIPE_THRESHOLD_PX = 50;

    // スワイプ開始を許可する左端の幅。端以外からの誤発火を防ぐ。
    const EDGE_START_PX = 28;



    // 指を離したとき、元位置へ戻す際の補間時間。
    const RESTORE_DURATION_MS = 220;

    // 補間カーブ（自然な減速を狙う）。
    const RESTORE_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

    // ------------------------------
    // ユーティリティ
    // ------------------------------

    /**
     * スワイプで付与した inline style を初期状態へ戻す。
     * 右側余白や位置ズレの残留を防ぐため、transform/transition を全消去する。
     */
    function resetSwipeStyles(viewHome, viewResults) {
        if (!viewHome || !viewResults) return;

        viewResults.style.transform = '';
        viewHome.style.transform = '';
        viewResults.style.transition = '';
        viewHome.style.transition = '';
    }

    /**
     * 現在の状態でスワイプ処理を許可できるか判定する。
     * - 検索画面表示中
     * - モーダル非表示
     */
    function canHandleSwipe(viewResults, modalOverlay) {
        if (!viewResults.classList.contains('active')) return false;
        if (modalOverlay && modalOverlay.classList.contains('active')) return false;
        return true;
    }

    /**
     * スワイプが未成立だったとき、元の位置へ自然に戻す。
     * transition を一時的に明示することで、
     * 「途中でやめた際の不自然な戻り」を解消する。
     */
    function animateBackToRest(viewHome, viewResults) {
        viewResults.style.transition = 'transform ' + RESTORE_DURATION_MS + 'ms ' + RESTORE_EASING;
        viewHome.style.transition = 'transform ' + RESTORE_DURATION_MS + 'ms ' + RESTORE_EASING;

        viewResults.style.transform = 'translateX(0px)';
        viewHome.style.transform = 'scale(1)';

        window.setTimeout(() => {
            resetSwipeStyles(viewHome, viewResults);
        }, RESTORE_DURATION_MS + 20);
    }

    /**
     * 既存の goToResults / goToHome をラップして、
     * 画面遷移ごとにスワイプ状態を完全初期化する。
     */
    function wrapNavigationFunctions(viewHome, viewResults) {
        if (typeof window.goToResults === 'function') {
            const originalGoToResults = window.goToResults;
            window.goToResults = function (...args) {
                resetSwipeStyles(viewHome, viewResults);
                return originalGoToResults.apply(this, args);
            };
        }

        if (typeof window.goToHome === 'function') {
            const originalGoToHome = window.goToHome;
            window.goToHome = function (...args) {
                resetSwipeStyles(viewHome, viewResults);
                return originalGoToHome.apply(this, args);
            };
        }
    }

    // ------------------------------
    // メイン処理
    // ------------------------------

    // 左端からの右スワイプで「検索画面 → ホーム画面」へ戻る機能を構築する。
 
    function setupSwipeNavigation() {
        const isSmartphone = window.matchMedia(MOBILE_QUERY).matches;
        if (!isSmartphone) return;

        const viewHome = document.getElementById('view-home');
        const viewResults = document.getElementById('view-search-results');
        const modalOverlay = document.getElementById('modal-overlay');
        if (!viewHome || !viewResults) return;

        wrapNavigationFunctions(viewHome, viewResults);

        // ジェスチャー内部状態
        let touchStartX = 0;
        let touchStartY = 0;
        let isTracking = false; // 有効な開始条件を満たしたタッチか
        let isSwipingBack = false; // 右スワイプとして成立したか

        // touchstart は受動のまま。ここでは preventDefault しない。
        document.addEventListener('touchstart', (e) => {
            isTracking = false;
            isSwipingBack = false;

            // トップ画面では無効（要件）。
            if (!canHandleSwipe(viewResults, modalOverlay)) return;

            const startX = e.touches[0].clientX;
            const startY = e.touches[0].clientY;

            // 左端以外からの開始は無視（要件）。
            if (startX > EDGE_START_PX) return;

            isTracking = true;
            touchStartX = startX;
            touchStartY = startY;

            // 指追従のため、ドラッグ中は transition を切る。
            viewResults.style.transition = 'none';
            viewHome.style.transition = 'none';
        }, { passive: true });

        // 競合回避のため、必要時のみ preventDefault できるよう passive:false。
        document.addEventListener('touchmove', (e) => {
            if (!isTracking) return;
            if (!canHandleSwipe(viewResults, modalOverlay)) return;

            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const deltaX = currentX - touchStartX;
            const deltaY = currentY - touchStartY;

            // 縦移動の意図が強い場合は通常スクロール優先。
            if (Math.abs(deltaY) > Math.abs(deltaX) * 0.7) return;

            // 右方向の移動のみ処理。
            if (deltaX <= 0) return;

            // ブラウザ標準の「戻るスワイプ」と競合しやすい場面を抑制。
            e.preventDefault();

            isSwipingBack = true;

            // 画面幅を超えないように clamp して余白発生を防ぐ。
            const translateX = Math.min(Math.max(deltaX, 0), window.innerWidth);
            viewResults.style.transform = 'translateX(' + translateX + 'px)';

            // 背景ホーム画面をほんの少し拡大し、遷移感を付与。
            const progress = Math.min(translateX / window.innerWidth, 1);
            const homeScale = 0.98 + progress * 0.02;
            viewHome.style.transform = 'scale(' + homeScale + ')';
        }, { passive: false });

        document.addEventListener('touchend', (e) => {
            // tracking していないタッチ終了は無視。
            if (!isTracking) return;

            const touchEndX = e.changedTouches[0].clientX;
            const deltaX = touchEndX - touchStartX;

            // 途中キャンセルも含め、終了時は必ず tracking を解除。
            isTracking = false;

            if (!isSwipingBack) {
                // 右スワイプとして成立しなかった場合でも
                // transition が none のまま残らないように戻す。
                resetSwipeStyles(viewHome, viewResults);
                return;
            }

            if (deltaX < SWIPE_THRESHOLD_PX) {
                // 途中でやめた場合: 自然な補間で元位置へ戻す。
                animateBackToRest(viewHome, viewResults);
                isSwipingBack = false;
                return;
            }

            // 閾値以上: ホームへ戻る。
            resetSwipeStyles(viewHome, viewResults);
            if (typeof window.goToHome === 'function') {
                window.goToHome();
            }
            isSwipingBack = false;
        }, { passive: true });

        // OS 割り込み等の touchcancel でも状態を確実に回収。
        document.addEventListener('touchcancel', () => {
            if (!isTracking && !isSwipingBack) return;
            isTracking = false;
            isSwipingBack = false;
            animateBackToRest(viewHome, viewResults);
        }, { passive: true });
    }

    // DOM 構築後に初期化して、対象要素を安全に取得する。
    document.addEventListener('DOMContentLoaded', setupSwipeNavigation);
})();

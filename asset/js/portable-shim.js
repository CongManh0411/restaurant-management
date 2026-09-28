// portable-shim.js - chay web bang cach bam dup (file://), khong can server.
// Chi thay fetch('sidebar.html') bang noi dung nhung san. Khong dung logic nao khac.
(function () {
    const SIDEBAR = `<!-- File này chỉ chứa sidebar, sẽ được nạp vào mọi trang bằng JS .
     Muốn đổi logo, tên... chỉ cần sửa DUY NHẤT file này.
     Riêng các mục menu được script.js vẽ theo vai trò). -->
<aside class="sidebar">
    <!-- Logo + tên quán -->
    <div class="sidebar-shop">
        <img src="asset/images/images.jpg" alt="Coffee Logo" class="shop-logo" id="shopLogo">
    </div>

    <!-- User đang đăng nhập + chức vụ — nội dung "Tên"/"Chức vụ" chỉ là mặc định,
         sẽ được script.js (UserAPI) ghi đè bằng dữ liệu thật khi trang tải xong. -->
    <div class="sidebar-user">
        <div class="user-name" id="userName">Tên</div>
        <div class="user-role" id="userRole">Chức vụ</div>
    </div>

    <div class="sidebar-nav">
        <div class="sidebar-menu">
            <div class="sidebar-menu" id="sidebarMenu"></div>
        </div>
    </div>

    <!-- Đăng xuất — luôn nằm ở đáy sidebar nhờ margin-top:auto trong CSS -->
    <div class="sidebar-footer">
        <button type="button" class="btn-logout" id="btnLogout">
            <i class="ri-logout-box-r-line"></i>
            Đăng xuất
        </button>
    </div>
</aside>
`;

    const originalFetch = window.fetch;

    window.fetch = function (url) {
        if (String(url).split('?')[0].endsWith('sidebar.html')) {
            return Promise.resolve(new Response(SIDEBAR));
        }
        return originalFetch.apply(this, arguments);
    };
})();
package com.dartinsight.admin.controller;

import com.dartinsight.admin.dto.AdminUserListResponse;
import com.dartinsight.admin.service.AdminUserService;
import com.dartinsight.common.web.ApiPaths;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 관리자 회원 목록(docs/api-spec.md GET /api/admin/users, FS-72). 관리자인지는 SecurityConfig가 확인한다(ADR-0040). */
@RestController
@RequestMapping(ApiPaths.ADMIN_USERS)
@RequiredArgsConstructor
public class AdminUserController {
    private final AdminUserService adminUserService;

    @GetMapping
    public AdminUserListResponse list(@RequestParam(required = false) String q,
            @RequestParam(required = false) String role, @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size) {
        return adminUserService.list(q, role, page, size);
    }
}

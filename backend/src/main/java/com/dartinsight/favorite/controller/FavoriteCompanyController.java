package com.dartinsight.favorite.controller;

import com.dartinsight.common.web.ApiPaths;
import com.dartinsight.favorite.dto.FavoriteCompanyListResponse;
import com.dartinsight.favorite.dto.FavoriteCompanyResponse;
import com.dartinsight.favorite.service.FavoriteCompanyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 관심 기업 API(docs/api-spec.md). 화면 W-01 ①②. 로그인한 회원만 쓴다(SecurityConfig가 JWT를 요구).
 */
@RestController
@RequestMapping(ApiPaths.FAVORITE_COMPANIES)
@RequiredArgsConstructor
public class FavoriteCompanyController {
    private final FavoriteCompanyService favoriteCompanyService;

    @GetMapping
    public FavoriteCompanyListResponse list(@AuthenticationPrincipal Jwt jwt) {
        return new FavoriteCompanyListResponse(favoriteCompanyService.list(userId(jwt)));
    }

    @PutMapping(ApiPaths.BY_CORP_CODE)
    public FavoriteCompanyResponse add(@AuthenticationPrincipal Jwt jwt, @PathVariable String corpCode) {
        return favoriteCompanyService.add(userId(jwt), corpCode);
    }

    @DeleteMapping(ApiPaths.BY_CORP_CODE)
    public ResponseEntity<Void> remove(@AuthenticationPrincipal Jwt jwt, @PathVariable String corpCode) {
        favoriteCompanyService.remove(userId(jwt), corpCode);
        return ResponseEntity.noContent().build();
    }

    private static long userId(Jwt jwt) {
        return Long.parseLong(jwt.getSubject());
    }
}

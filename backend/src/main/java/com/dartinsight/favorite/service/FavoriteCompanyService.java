package com.dartinsight.favorite.service;

import com.dartinsight.company.domain.Company;
import com.dartinsight.company.service.CompanyService;
import com.dartinsight.favorite.domain.FavoriteCompany;
import com.dartinsight.favorite.domain.WatchStats;
import com.dartinsight.favorite.domain.WatchStats.WatchedCompany;
import com.dartinsight.favorite.dto.FavoriteCompanyResponse;
import com.dartinsight.favorite.repository.CorpFavoriteCount;
import com.dartinsight.favorite.repository.FavoriteCompanyRepository;
import com.dartinsight.favorite.repository.UserFavoriteCount;
import com.dartinsight.user.service.UserService;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 로그인한 회원의 관심 기업(6.2, #36). 회원은 언제나 토큰의 사용자 ID로만 정해, 다른 회원의 목록은 건드릴 수 없다.
 */
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class FavoriteCompanyService {
    /** 회원당 최대 개수. 넘으면 가장 먼저 추가한 기업을 뺀다(브라우저 저장 때와 같은 동작). */
    public static final int LIMIT = 12;

    private final FavoriteCompanyRepository favorites;
    private final CompanyService companyService;
    private final UserService userService;
    private final Clock clock;

    public List<FavoriteCompanyResponse> list(long userId) {
        userService.requireExisting(userId);
        List<FavoriteCompany> rows = favorites.findByUserIdOrderByCreatedAtDescIdDesc(userId);
        Map<String, Company> companies = companyService.getAll(rows.stream().map(FavoriteCompany::getCorpCode).toList())
                .stream().collect(Collectors.toMap(Company::getCorpCode, Function.identity()));
        return rows.stream()
                .filter(row -> companies.containsKey(row.getCorpCode()))
                .map(row -> FavoriteCompanyResponse.of(row, companies.get(row.getCorpCode())))
                .toList();
    }

    /** 이 기업을 지금 즐겨찾기한 회원 ID */
    public List<Long> userIdsFavoriting(String corpCode) {
        return favorites.findUserIdsByCorpCode(corpCode);
    }

    /** 지금 전체 관심 기업 수와 많이 담은 기업 top개(관리자 개요) */
    public WatchStats watchStats(int top) {
        List<CorpFavoriteCount> most = favorites.findMostFavorited(PageRequest.of(0, top));
        Map<String, String> names = companyService.getAll(most.stream().map(CorpFavoriteCount::getCorpCode).toList())
                .stream().collect(Collectors.toMap(Company::getCorpCode, Company::getCorpName));
        return new WatchStats(favorites.count(), favorites.countDistinctCorpCodes(), most.stream()
                .map(row -> new WatchedCompany(row.getCorpCode(), names.get(row.getCorpCode()), row.getCount()))
                .toList());
    }

    /** 회원 ID → 관심 기업 수(없는 회원은 빠짐). 관리자 회원 목록 */
    public Map<Long, Long> countsByUser(Collection<Long> userIds) {
        if (userIds.isEmpty()) return Map.of();
        return favorites.countByUserIds(userIds).stream()
                .collect(Collectors.toMap(UserFavoriteCount::getUserId, UserFavoriteCount::getCount));
    }

    /** 이미 있으면 그대로 돌려준다(중복 행·시각 변경 없음). 없는 기업은 COMPANY_NOT_FOUND. */
    @Transactional
    public FavoriteCompanyResponse add(long userId, String corpCode) {
        // 동시에 들어온 추가(여러 탭·재시도)가 중복 행이나 13곳을 만들지 않게 회원 단위로 차례를 세운다
        userService.lock(userId);
        Company company = companyService.get(corpCode);
        FavoriteCompany favorite = favorites.findByUserIdAndCorpCode(userId, corpCode)
                .orElseGet(() -> create(userId, corpCode));
        return FavoriteCompanyResponse.of(favorite, company);
    }

    /** 없던 기업이어도 조용히 끝난다. */
    @Transactional
    public void remove(long userId, String corpCode) {
        // 삭제는 행을 읽은 뒤 지우므로, 동시에 같은 행을 지우면(두 탭, 추가가 밀어낸 행) 없는 행 삭제로 실패한다. add와 같이 차례를 세운다
        userService.lock(userId);
        favorites.deleteByUserIdAndCorpCode(userId, corpCode);
    }

    private FavoriteCompany create(long userId, String corpCode) {
        List<FavoriteCompany> current = favorites.findByUserIdOrderByCreatedAtDescIdDesc(userId);
        if (current.size() >= LIMIT) {
            favorites.deleteAll(current.subList(LIMIT - 1, current.size()));
            favorites.flush();
        }
        return favorites.save(FavoriteCompany.create(userId, corpCode, LocalDateTime.now(clock)));
    }
}

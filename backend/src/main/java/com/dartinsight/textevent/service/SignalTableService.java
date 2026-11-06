package com.dartinsight.textevent.service;

import com.dartinsight.aiserver.client.AiServerClient;
import com.dartinsight.aiserver.client.AiServerException;
import com.dartinsight.aiserver.client.AiServerPaths;
import com.dartinsight.common.error.ApiException;
import com.dartinsight.common.error.ErrorCode;
import com.dartinsight.textevent.domain.SignalTable;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 사건 신호 기준표(ADR-0060). 파일은 ai-server에만 두고, backend는 받은 기준표를 버전별로 메모리에 둔다.
 * 사건과 표의 버전은 사건 버전(EVENT_VERSION)을 함께 올려 맞추므로, 화면에는 지금 기준표를 보여 준다.
 */
@Service
@RequiredArgsConstructor
public class SignalTableService {

    private final AiServerClient aiServerClient;
    private final Map<String, SignalTable> byVersion = new ConcurrentHashMap<>();
    private final AtomicReference<SignalTable> latest = new AtomicReference<>();

    /** ai-server의 지금 기준표. 받지 못하면 마지막으로 받은 기준표, 그것도 없으면 503 AI_SERVER_UNAVAILABLE */
    public SignalTable current() {
        try {
            return fetch();
        } catch (AiServerException e) {
            SignalTable last = latest.get();
            if (last == null) {
                throw new ApiException(ErrorCode.AI_SERVER_UNAVAILABLE);
            }
            return last;
        }
    }

    /** 사건을 만들 때 쓴 버전의 기준표. 메모리에 없으면 지금 기준표를 받아 버전이 같을 때만 쓴다 */
    public SignalTable table(String version) {
        SignalTable known = byVersion.get(version);
        if (known != null) {
            return known;
        }
        SignalTable fetched = fetch();
        if (!fetched.version().equals(version)) {
            throw new IllegalStateException("기준표 " + version + "을 찾지 못했습니다(지금 " + fetched.version() + ").");
        }
        return fetched;
    }

    private SignalTable fetch() {
        SignalTable table = aiServerClient.get(AiServerPaths.SIGNAL_TABLES, SignalTable.class);
        if (table == null || table.version() == null) {
            throw new IllegalStateException("기준표 응답에 버전이 없습니다.");
        }
        byVersion.put(table.version(), table);
        latest.set(table);
        return table;
    }
}

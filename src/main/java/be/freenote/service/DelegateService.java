package be.freenote.service;

import be.freenote.dto.request.AssignDelegateRequest;
import be.freenote.dto.request.EndDelegateRequest;
import be.freenote.dto.request.UpdateDelegateRequest;
import be.freenote.dto.response.DelegateHistoryResponse;
import be.freenote.dto.response.DelegateMember;
import be.freenote.dto.response.DelegateResponse;

import java.util.List;

public interface DelegateService {
    List<DelegateResponse> getActiveDelegates();
    /** Former delegates: ended mandates, grouped by section. */
    List<DelegateResponse> getFormerDelegates();
    List<DelegateHistoryResponse> getHistory(Long userId);
    List<DelegateMember> getAllMandates();
    DelegateMember assignDelegate(AssignDelegateRequest request);
    DelegateMember endDelegate(Long historyId, EndDelegateRequest request);
    DelegateMember updateMandate(Long historyId, UpdateDelegateRequest request);
    void deleteMandate(Long historyId);
}

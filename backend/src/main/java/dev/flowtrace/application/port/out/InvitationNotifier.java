package dev.flowtrace.application.port.out;

import dev.flowtrace.domain.Invitation;
import dev.flowtrace.domain.Organization;

/**
 * Outbound port for delivering organization invitation emails (AWS SES / SendGrid / local log).
 */
public interface InvitationNotifier {

    void sendInvitationEmail(Organization organization, Invitation invitation, String acceptUrl);
}

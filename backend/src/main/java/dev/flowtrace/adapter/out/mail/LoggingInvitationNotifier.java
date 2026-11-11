package dev.flowtrace.adapter.out.mail;

import dev.flowtrace.application.port.out.InvitationNotifier;
import dev.flowtrace.domain.Invitation;
import dev.flowtrace.domain.Organization;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import org.jboss.logging.Logger;

/**
 * Outbound adapter for invitation email delivery (TASK-1.3).
 * Logs structured dispatch events and maintains an in-memory outbox for local dev and automated verification.
 */
@ApplicationScoped
public class LoggingInvitationNotifier implements InvitationNotifier {

    private static final Logger LOG = Logger.getLogger(LoggingInvitationNotifier.class);

    public record SentInvitationMail(
            String recipientEmail,
            String organizationName,
            String role,
            String token,
            String acceptUrl
    ) {
    }

    private final List<SentInvitationMail> outbox = new CopyOnWriteArrayList<>();

    @Override
    public void sendInvitationEmail(Organization organization, Invitation invitation, String acceptUrl) {
        SentInvitationMail mail = new SentInvitationMail(
                invitation.email(),
                organization.name(),
                invitation.role().name(),
                invitation.token(),
                acceptUrl
        );
        outbox.add(mail);
        LOG.infof(
                "Dispatched organization invitation email to=%s org=%s role=%s acceptUrl=%s",
                invitation.email(),
                organization.slug(),
                invitation.role(),
                acceptUrl
        );
    }

    public List<SentInvitationMail> getOutbox() {
        return List.copyOf(outbox);
    }
}

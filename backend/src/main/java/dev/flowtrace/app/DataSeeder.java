package dev.flowtrace.app;

import dev.flowtrace.adapter.out.pg.JdbcOrganizationRepository;
import dev.flowtrace.adapter.out.pg.JdbcProjectRepository;
import dev.flowtrace.application.DemoSimulator;
import dev.flowtrace.application.ProjectService;
import dev.flowtrace.domain.ApiKeyCrypto;
import dev.flowtrace.domain.DiagramGraph;
import dev.flowtrace.domain.Organization;
import dev.flowtrace.domain.Project;
import dev.flowtrace.domain.Workspace;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import java.util.List;
import java.util.UUID;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Seeds a default organization, workspace, sample project, API key (`ft_live_demo0000000000000000000000000000`),
 * and optionally starts the live DemoSimulator so the UI is immediately alive on startup.
 */
@ApplicationScoped
public class DataSeeder {

    private static final Logger LOG = Logger.getLogger(DataSeeder.class);

    private final JdbcProjectRepository projectRepository;
    private final JdbcOrganizationRepository organizationRepository;
    private final DemoSimulator demoSimulator;
    private final boolean autoStartDemo;

    @Inject
    public DataSeeder(
            JdbcProjectRepository projectRepository,
            JdbcOrganizationRepository organizationRepository,
            DemoSimulator demoSimulator,
            @ConfigProperty(name = "flowtrace.demo.auto-start", defaultValue = "true") boolean autoStartDemo
    ) {
        this.projectRepository = projectRepository;
        this.organizationRepository = organizationRepository;
        this.demoSimulator = demoSimulator;
        this.autoStartDemo = autoStartDemo;
    }

    void onStart(@Observes StartupEvent ev) {
        UUID userId = projectRepository.ensureUser("local-dev-user", "dev@flowtrace.local");
        Organization org = organizationRepository.ensurePersonalOrganization(userId, "dev@flowtrace.local");
        List<Workspace> workspaces = organizationRepository.listWorkspaces(org.id());
        UUID defaultWsId = workspaces.isEmpty() ? null : workspaces.getFirst().id();

        List<Project> existing = projectRepository.findByOwner(userId);
        UUID targetProjectId;
        if (existing.isEmpty()) {
            Project created = projectRepository.createProjectWithId(
                    ProjectService.SEED_PROJECT_ID,
                    userId,
                    org.id(),
                    defaultWsId,
                    "E-Commerce Checkout Flow",
                    true,
                    7,
                    DiagramGraph.onlineShopDiagram()
            );
            targetProjectId = created.id();
            ApiKeyCrypto.GeneratedKey seedKey = ApiKeyCrypto.fromRawKey(ProjectService.SEED_API_KEY);
            projectRepository.createApiKey(
                    targetProjectId,
                    "Default Demo Key",
                    seedKey.keyPrefix(),
                    seedKey.keyHash(),
                    1000
            );
            LOG.infof("Seeded default project %s in organization %s (%s)", targetProjectId, org.name(), org.id());
        } else {
            targetProjectId = existing.getFirst().id();
        }

        if (autoStartDemo) {
            demoSimulator.startDemo(targetProjectId, 2.5, 0.04);
            LOG.infof("Started DemoSimulator on project %s", targetProjectId);
        }
    }
}

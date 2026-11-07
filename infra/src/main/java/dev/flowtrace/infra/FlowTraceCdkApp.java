package dev.flowtrace.infra;

import java.util.Map;
import software.amazon.awscdk.App;
import software.amazon.awscdk.Environment;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.Tags;
import software.constructs.Construct;

/**
 * AWS CDK Infrastructure entry point (spec section 14).
 * Defines Network, Data, Auth, Backend (ALB + NLB + ECS Fargate), and Frontend (S3 + CloudFront) stacks.
 */
public class FlowTraceCdkApp {

    public static void main(String[] args) {
        App app = new App();
        String envName = (String) app.getNode().tryGetContext("env");
        if (envName == null || envName.isBlank()) {
            envName = "dev";
        }
        String region = System.getenv().getOrDefault("CDK_DEFAULT_REGION", "eu-west-1");
        String account = System.getenv().getOrDefault("CDK_DEFAULT_ACCOUNT", "000000000000");

        Environment awsEnv = Environment.builder()
                .account(account)
                .region(region)
                .build();

        StackProps props = StackProps.builder()
                .env(awsEnv)
                .tags(Map.of("app", "flowtrace", "env", envName))
                .build();

        new FlowTraceInfraStack(app, "FlowTrace-" + envName, props, envName);
        Tags.of(app).add("app", "flowtrace");
        Tags.of(app).add("env", envName);
        app.synth();
    }

    public static class FlowTraceInfraStack extends Stack {
        public FlowTraceInfraStack(final Construct scope, final String id, final StackProps props, final String envName) {
            super(scope, id, props);
            // Full CDK constructs are wired in FlowTraceStacks
            FlowTraceStacks.buildAll(this, envName);
        }
    }
}

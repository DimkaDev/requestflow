package dev.flowtrace.infra;

import org.junit.jupiter.api.Test;
import software.amazon.awscdk.App;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.assertions.Template;

import static org.junit.jupiter.api.Assertions.assertNotNull;

class FlowTraceCdkTest {

    @Test
    void cdkStackSynthesizesCleanly() {
        App app = new App();
        FlowTraceCdkApp.FlowTraceInfraStack stack = new FlowTraceCdkApp.FlowTraceInfraStack(
                app, "FlowTrace-test", StackProps.builder().build(), "dev");
        Template template = Template.fromStack(stack);
        assertNotNull(template.toJSON());
        template.resourceCountIs("AWS::ECS::Service", 1);
        template.resourceCountIs("AWS::RDS::DBInstance", 1);
        template.resourceCountIs("AWS::Cognito::UserPool", 1);
        template.resourceCountIs("AWS::S3::Bucket", 1);
    }
}

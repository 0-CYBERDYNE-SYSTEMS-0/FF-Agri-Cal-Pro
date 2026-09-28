CREATE TABLE "assistant_action_approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"conversation_id" integer NOT NULL,
	"tool_call" json NOT NULL,
	"summary" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"claimed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assistant_action_approvals" ADD CONSTRAINT "assistant_action_approvals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assistant_action_approvals" ADD CONSTRAINT "assistant_action_approvals_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
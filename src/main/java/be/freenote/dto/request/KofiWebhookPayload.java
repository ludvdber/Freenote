package be.freenote.dto.request;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class KofiWebhookPayload {

    @JsonProperty("verification_token")
    private String verificationToken;

    @JsonProperty("message_id")
    private String messageId;

    @JsonProperty("timestamp")
    private String timestamp;

    @JsonProperty("type")
    private String type; // "Tip" (ex-"Donation"), "Subscription", "Commission", "Shop Order"

    @JsonProperty("is_public")
    private boolean isPublic;

    @JsonProperty("from_name")
    private String fromName;

    @JsonProperty("message")
    private String message;

    @JsonProperty("amount")
    private String amount; // "3.00"

    @JsonProperty("currency")
    private String currency;

    @JsonProperty("kofi_transaction_id")
    private String kofiTransactionId;

    @JsonProperty("email")
    private String email;
}

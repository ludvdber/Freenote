package be.freenote.security.ratelimit;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RateLimit {
    int max() default 10;
    long window() default 60;

    /** Les uploaders « confiance » (users.trusted, lu en base) échappent-ils à cette limite ?
     *  Réservé à l'upload de documents — le statut confiance ne doit pas devenir un bypass global. */
    boolean exemptTrusted() default false;
}

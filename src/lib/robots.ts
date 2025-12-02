import { URL } from 'url';

type RobotsRule = {
    userAgent: string;
    disallow: string[];
    allow: string[];
};

const cache = new Map<string, RobotsRule[]>();

/**
 * Fetches and parses robots.txt for a given URL.
 * Checks if the given user agent is allowed to access the path.
 */
export async function isScrapingAllowed(targetUrl: string, userAgent: string = '*'): Promise<boolean> {
    try {
        const url = new URL(targetUrl);
        const origin = url.origin;
        const robotsUrl = `${origin}/robots.txt`;

        let rules = cache.get(origin);

        if (!rules) {
            try {
                const response = await fetch(robotsUrl, {
                    next: { revalidate: 3600 } // Cache for 1 hour
                });

                if (response.status === 404) {
                    // No robots.txt means allowed
                    cache.set(origin, []);
                    return true;
                }

                if (!response.ok) {
                    // If other error, assume allowed but log warning
                    console.warn(`Failed to fetch robots.txt for ${origin}: ${response.status}`);
                    return true;
                }

                const text = await response.text();
                rules = parseRobotsTxt(text);
                cache.set(origin, rules);
            } catch (error) {
                console.error(`Error fetching robots.txt for ${origin}:`, error);
                // Fail open (allow) if network error, or fail closed?
                // Usually fail open for connectivity issues unless strict compliance required.
                // For this app, let's fail open but log.
                return true;
            }
        }

        return checkRules(url.pathname, userAgent, rules || []);

    } catch (error) {
        console.error('Error checking robots.txt:', error);
        return true; // Invalid URL or other error, default to allow
    }
}

function parseRobotsTxt(text: string): RobotsRule[] {
    const rules: RobotsRule[] = [];
    let currentUserAgents: string[] = [];
    let currentDisallows: string[] = [];
    let currentAllows: string[] = [];

    const lines = text.split('\n');

    for (const line of lines) {
        const cleanLine = line.trim();
        if (!cleanLine || cleanLine.startsWith('#')) continue;

        const [key, ...values] = cleanLine.split(':');
        const value = values.join(':').trim();
        const lowerKey = key.toLowerCase().trim();

        if (lowerKey === 'user-agent') {
            // If we have accumulated rules for previous agents, push them
            if (currentUserAgents.length > 0) {
                for (const agent of currentUserAgents) {
                    rules.push({
                        userAgent: agent,
                        disallow: [...currentDisallows],
                        allow: [...currentAllows]
                    });
                }
                // Reset for next block, BUT keep agents if they were grouped?
                // Standard robots.txt: User-agent lines are grouped at start of record.
                // Once a non-User-agent line appears, the record body starts.
                // If we see User-agent again after body, it's a new record.
                if (currentDisallows.length > 0 || currentAllows.length > 0) {
                    currentUserAgents = [];
                    currentDisallows = [];
                    currentAllows = [];
                }
            }
            currentUserAgents.push(value);
        } else if (lowerKey === 'disallow') {
            if (value) currentDisallows.push(value);
        } else if (lowerKey === 'allow') {
            if (value) currentAllows.push(value);
        }
    }

    // Push last block
    if (currentUserAgents.length > 0) {
        for (const agent of currentUserAgents) {
            rules.push({
                userAgent: agent,
                disallow: [...currentDisallows],
                allow: [...currentAllows]
            });
        }
    }

    return rules;
}

function checkRules(path: string, userAgent: string, rules: RobotsRule[]): boolean {
    // 1. Find relevant rules
    // Specific user agent takes precedence over '*'
    const specificRules = rules.filter(r =>
        userAgent.toLowerCase().includes(r.userAgent.toLowerCase()) && r.userAgent !== '*'
    );
    const wildcardRules = rules.filter(r => r.userAgent === '*');

    const applicableRules = specificRules.length > 0 ? specificRules : wildcardRules;

    if (applicableRules.length === 0) return true; // No rules for this agent

    // 2. Check Allow/Disallow
    // "The most specific rule based on the length of the [path] entry wins"
    // If lengths are equal, Allow wins over Disallow (usually)

    let bestMatchLength = -1;
    let allowed = true;

    for (const rule of applicableRules) {
        // Check Disallow
        for (const pattern of rule.disallow) {
            if (matches(path, pattern)) {
                if (pattern.length > bestMatchLength) {
                    bestMatchLength = pattern.length;
                    allowed = false;
                }
            }
        }

        // Check Allow (overrides Disallow if same or longer length)
        for (const pattern of rule.allow) {
            if (matches(path, pattern)) {
                if (pattern.length >= bestMatchLength) {
                    bestMatchLength = pattern.length;
                    allowed = true;
                }
            }
        }
    }

    return allowed;
}

function matches(path: string, pattern: string): boolean {
    // Simple prefix match for now (standard robots.txt)
    // Support for wildcards (*) is common but basic prefix is MVP
    if (pattern === '/') return true; // Matches everything

    // Handle simple wildcards if needed, but standard says:
    // "Matches if the path starts with the pattern"

    // If pattern ends with *, remove it for prefix check
    const cleanPattern = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern;

    return path.startsWith(cleanPattern);
}
